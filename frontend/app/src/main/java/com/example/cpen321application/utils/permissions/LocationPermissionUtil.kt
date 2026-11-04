package com.example.cpen321application.utils.permissions

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

/**
 * The outcome of a location permission request.
 *
 * APPROXIMATE is a valid, non-error state on Android 12+: the user granted
 * ACCESS_COARSE_LOCATION but declined ACCESS_FINE_LOCATION.
 */
enum class LocationAccess { PRECISE, APPROXIMATE, DENIED }

/** All user-facing text and behavior switches in one place. */
data class LocationPermissionConfig(
    val rationaleTitle: String = "Location access needed",
    val rationaleMessage: String =
        "We use your location to show nearby results and give accurate directions. " +
                "Precise location gives the best results, but approximate location also works.",
    val rationaleContinue: String = "Continue",
    val rationaleDecline: String = "Not now",

    val settingsTitle: String = "Location permission required",
    val settingsMessage: String =
        "Location access has been turned off for this app. " +
                "You can enable it in Settings \u2192 Permissions \u2192 Location.",
    val settingsOpen: String = "Open Settings",
    val settingsCancel: String = "Cancel",

    val offerPreciseUpgrade: Boolean = true,
    val upgradeTitle: String = "Approximate location only",
    val upgradeMessage: String =
        "Some features work best with precise location. Want to enable it?",
    val upgradeAccept: String = "Enable precise",
    val upgradeDecline: String = "Keep approximate"
)

/**
 * Single entry point for requesting precise/approximate location in Compose.
 *
 * Call [rememberLocationPermissionState] once in your screen. It registers the
 * permission launcher, emits the rationale / upgrade / Settings dialogs for you,
 * and re-checks when the user returns from Settings.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 * ---------------------------------------------------------------------------
 *   @Composable
 *   fun NearbyScreen(viewModel: NearbyViewModel = viewModel()) {
 *
 *       val location = rememberLocationPermissionState { access ->
 *           // Runs on the main thread, outside composition. Good place to
 *           // forward the result to a ViewModel.
 *           viewModel.onLocationAccess(access)
 *       }
 *
 *       Column {
 *           Button(onClick = location::request) { Text("Find nearby") }
 *
 *           // `access` is observable state, so the UI can react to it directly.
 *           when (location.access) {
 *               LocationAccess.PRECISE     -> Text("Using precise location")
 *               LocationAccess.APPROXIMATE -> Text("Using approximate location")
 *               LocationAccess.DENIED      -> Text("Enter your city manually")
 *           }
 *       }
 *   }
 *
 * ---------------------------------------------------------------------------
 * NOTES
 * ---------------------------------------------------------------------------
 *  - Dependencies: androidx.activity:activity-compose,
 *    androidx.compose.material3, androidx.lifecycle:lifecycle-runtime-compose
 *    (2.7+ for LifecycleEventEffect), androidx.core.
 *  - Manifest must declare BOTH ACCESS_COARSE_LOCATION and ACCESS_FINE_LOCATION.
 *  - The onResult callback may fire more than once per [request]: for example,
 *    APPROXIMATE first, then PRECISE if the user accepts the upgrade prompt.
 *  - [access] is refreshed every time the screen resumes, so it also reflects
 *    changes made in Settings or the expiry of a one-time grant. Still call
 *    [refresh] right before using location if you need a guarantee.
 *  - Internal flags and the open dialog survive rotation and process death.
 *  - Background location is NOT handled here; it needs its own later request.
 *  - Move the default strings in [LocationPermissionConfig] into strings.xml
 *    (resolve with stringResource) for localization.
 */
@Composable
fun rememberLocationPermissionState(
    config: LocationPermissionConfig = LocationPermissionConfig(),
    onResult: (LocationAccess) -> Unit = {}
): LocationPermissionState {
    val activity = LocalContext.current.findActivity()

    val state = rememberSaveable(saver = LocationPermissionState.saver(activity)) {
        LocationPermissionState(activity)
    }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { state.onSystemResult() }

    SideEffect {
        state.config = config
        state.onResult = onResult
        state.launchSystemDialog = { launcher.launch(LOCATION_PERMISSIONS) }
    }

    // Fires on first composition too, which just refreshes `access`.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { state.onResume() }

    when (state.activeDialog) {
        LocationDialog.Rationale -> PermissionAlert(
            title = config.rationaleTitle,
            message = config.rationaleMessage,
            confirmLabel = config.rationaleContinue,
            dismissLabel = config.rationaleDecline,
            onConfirm = state::confirmDialog,
            onDismiss = state::dismissDialog
        )
        LocationDialog.Upgrade -> PermissionAlert(
            title = config.upgradeTitle,
            message = config.upgradeMessage,
            confirmLabel = config.upgradeAccept,
            dismissLabel = config.upgradeDecline,
            onConfirm = state::confirmDialog,
            onDismiss = state::dismissDialog
        )
        LocationDialog.Settings -> PermissionAlert(
            title = config.settingsTitle,
            message = config.settingsMessage,
            confirmLabel = config.settingsOpen,
            dismissLabel = config.settingsCancel,
            onConfirm = state::confirmDialog,
            onDismiss = state::dismissDialog
        )
        null -> Unit
    }

    return state
}

internal enum class LocationDialog { Rationale, Upgrade, Settings }

private val LOCATION_PERMISSIONS = arrayOf(
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION
)

/**
 * Holds the permission flow's state. Create it with [rememberLocationPermissionState].
 */
@Stable
class LocationPermissionState internal constructor(
    private val activity: Activity
) {
    internal var config: LocationPermissionConfig = LocationPermissionConfig()
    internal var onResult: (LocationAccess) -> Unit = {}
    internal var launchSystemDialog: () -> Unit = {}

    /** Observable. Reads of this value in composition recompose when it changes. */
    var access: LocationAccess by mutableStateOf(readAccess())
        private set

    internal var activeDialog: LocationDialog? by mutableStateOf(null)

    // Per-request() flags that prevent nagging loops. Saved across recreation.
    private var rationaleShown = false
    private var upgradeOffered = false
    private var awaitingSettingsReturn = false

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /** Re-reads the current permission state into [access]. No UI, no callback. */
    fun refresh(): LocationAccess = readAccess().also { access = it }

    /** Starts the full flow. Call this from a user action that needs location. */
    fun request() {
        rationaleShown = false
        upgradeOffered = false

        when (refresh()) {
            LocationAccess.PRECISE -> onResult(LocationAccess.PRECISE)
            LocationAccess.APPROXIMATE -> handleApproximate()
            LocationAccess.DENIED ->
                // True only if the user denied before and can still be asked again.
                if (shouldShowRationale()) showDialog(LocationDialog.Rationale)
                else launchSystemDialog() // First ask, or permanently denied
        }
    }

    // ------------------------------------------------------------------
    // Result handling (internal; driven by the launcher and dialogs)
    // ------------------------------------------------------------------

    internal fun onSystemResult() {
        when (refresh()) {
            LocationAccess.PRECISE -> onResult(LocationAccess.PRECISE)
            LocationAccess.APPROXIMATE -> handleApproximate()
            LocationAccess.DENIED -> when {
                // Reliable here because the request has just happened:
                // false after a denial means the system won't show the dialog again.
                !shouldShowRationale() -> showDialog(LocationDialog.Settings)
                !rationaleShown -> showDialog(LocationDialog.Rationale)
                else -> onResult(LocationAccess.DENIED)
            }
        }
    }

    private fun handleApproximate() {
        onResult(LocationAccess.APPROXIMATE)
        if (config.offerPreciseUpgrade && !upgradeOffered) {
            showDialog(LocationDialog.Upgrade)
        }
    }

    internal fun confirmDialog() {
        val dialog = activeDialog ?: return
        activeDialog = null
        when (dialog) {
            LocationDialog.Rationale, LocationDialog.Upgrade -> launchSystemDialog()
            LocationDialog.Settings -> openAppSettings()
        }
    }

    internal fun dismissDialog() {
        val dialog = activeDialog ?: return
        activeDialog = null
        when (dialog) {
            LocationDialog.Rationale, LocationDialog.Settings -> onResult(LocationAccess.DENIED)
            LocationDialog.Upgrade -> Unit // APPROXIMATE was already delivered
        }
    }

    /**
     * Runs on every ON_RESUME. Always refreshes [access]; additionally notifies
     * [onResult] once if we just sent the user to Settings.
     */
    internal fun onResume() {
        val latest = refresh()
        if (awaitingSettingsReturn) {
            awaitingSettingsReturn = false
            onResult(latest)
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private fun showDialog(dialog: LocationDialog) {
        when (dialog) {
            LocationDialog.Rationale -> rationaleShown = true
            LocationDialog.Upgrade -> upgradeOffered = true
            LocationDialog.Settings -> Unit
        }
        activeDialog = dialog
    }

    private fun openAppSettings() {
        awaitingSettingsReturn = true
        activity.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", activity.packageName, null)
            }
        )
    }

    private fun readAccess(): LocationAccess = when {
        isGranted(Manifest.permission.ACCESS_FINE_LOCATION) -> LocationAccess.PRECISE
        isGranted(Manifest.permission.ACCESS_COARSE_LOCATION) -> LocationAccess.APPROXIMATE
        else -> LocationAccess.DENIED
    }

    private fun isGranted(permission: String) =
        ContextCompat.checkSelfPermission(activity, permission) ==
                PackageManager.PERMISSION_GRANTED

    private fun shouldShowRationale() = LOCATION_PERMISSIONS.any {
        ActivityCompat.shouldShowRequestPermissionRationale(activity, it)
    }

    internal companion object {
        /** Persists the flow's flags and open dialog across rotation / process death. */
        fun saver(activity: Activity) = listSaver<LocationPermissionState, Any>(
            save = {
                listOf(
                    it.activeDialog?.name ?: "",
                    it.rationaleShown,
                    it.upgradeOffered,
                    it.awaitingSettingsReturn
                )
            },
            restore = { saved ->
                LocationPermissionState(activity).apply {
                    activeDialog = (saved[0] as String)
                        .takeIf { name -> name.isNotEmpty() }
                        ?.let(LocationDialog::valueOf)
                    rationaleShown = saved[1] as Boolean
                    upgradeOffered = saved[2] as Boolean
                    awaitingSettingsReturn = saved[3] as Boolean
                }
            }
        )
    }
}

// ----------------------------------------------------------------------
// UI
// ----------------------------------------------------------------------

@Composable
private fun PermissionAlert(
    title: String,
    message: String,
    confirmLabel: String,
    dismissLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss, // Back button / outside tap counts as declining
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirmLabel) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(dismissLabel) } }
    )
}

private tailrec fun Context.findActivity(): Activity = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> error("rememberLocationPermissionState must be called from within an Activity")
}