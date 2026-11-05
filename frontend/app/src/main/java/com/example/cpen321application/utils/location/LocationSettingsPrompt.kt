package com.example.cpen321application.utils.location


import android.app.Activity
import android.util.Log
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.LocationSettingsStatusCodes
import com.google.android.gms.location.Priority

/**
 * Checks that the device's Location switch is on and, if it isn't, shows the system's
 * "Turn on location?" dialog. This is separate from the runtime permission: a granted
 * permission does nothing while the device's location is switched off.
 *
 * Mirrors [rememberLocationPermissionState]'s style: one call in your screen, a result
 * callback, and a `request()` you trigger yourself.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 * ---------------------------------------------------------------------------
 *   val locationSettings = rememberLocationSettingsState { enabled ->
 *       showLocationOffDialog = !enabled   // enabled == false -> block and ask again
 *   }
 *
 *   // Call it once permission is granted (e.g. from the permission callback):
 *   locationSettings.request()
 *
 * ---------------------------------------------------------------------------
 * BEHAVIOR
 * ---------------------------------------------------------------------------
 *  - request(): checks, and if location is off, launches the system prompt. Use it for
 *    user-driven moments (first check, "Try again" button).
 *  - After the first request(), the state silently re-checks on every ON_RESUME (no
 *    prompt), so switching location off in Quick Settings and coming back is noticed.
 *    Silent matters: prompting on resume would re-open the system dialog right after
 *    the user declined it, in a loop.
 *  - The callback may fire more than once with the same value. Keep it idempotent.
 *  - Unexpected errors (e.g. transient Play Services failure) are logged and treated as
 *    enabled, so a hiccup never locks the user out. A genuinely unresolvable "location
 *    unavailable" status is reported as disabled.
 */
@Composable
fun rememberLocationSettingsState(
    onResult: (enabled: Boolean) -> Unit
): LocationSettingsState {
    val activity = LocalActivity.current
        ?: error("rememberLocationSettingsState must be called from within an Activity")

    val state = rememberSaveable(saver = LocationSettingsState.saver(activity)) {
        LocationSettingsState(activity)
    }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) {
        // Don't trust resultCode; re-read the real setting. Single source of truth.
        state.onResolutionFinished()
    }

    SideEffect {
        state.onResult = onResult
        state.launchResolution = { launcher.launch(it) }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { state.onResume() }

    return state
}

@Stable
class LocationSettingsState internal constructor(
    private val activity: Activity
) {
    internal var onResult: (Boolean) -> Unit = {}
    internal var launchResolution: (IntentSenderRequest) -> Unit = {}

    /** Observable. null until the first check completes. */
    var isEnabled: Boolean? by mutableStateOf(null)
        private set

    // active: a request() has happened, so resume re-checks are allowed (saved).
    // resolving: the system dialog is up, so don't start another check (not saved).
    private var active = false
    private var resolving = false

    /** Checks the setting and prompts the user to turn location on if it's off. */
    fun request() {
        active = true
        verify(promptIfDisabled = true)
    }

    internal fun onResume() {
        if (active && !resolving) verify(promptIfDisabled = false)
    }

    internal fun onResolutionFinished() {
        resolving = false
        verify(promptIfDisabled = false)
    }

    private fun verify(promptIfDisabled: Boolean) {
        if (resolving) return

        LocationServices.getSettingsClient(activity)
            .checkLocationSettings(SETTINGS_REQUEST)
            .addOnSuccessListener { report(true) }
            .addOnFailureListener { error -> handleFailure(error, promptIfDisabled) }
    }

    private fun handleFailure(error: Exception, promptIfDisabled: Boolean) {
        when {
            error is ResolvableApiException && promptIfDisabled -> {
                resolving = true
                launchResolution(IntentSenderRequest.Builder(error.resolution).build())
            }

            // Disabled, but we're not allowed to prompt right now (silent re-check).
            error is ResolvableApiException -> report(false)

            // Disabled and the system can't offer to fix it.
            error is ApiException &&
                    error.statusCode == LocationSettingsStatusCodes.SETTINGS_CHANGE_UNAVAILABLE ->
                report(false)

            // Anything else is not evidence that location is off. Fail open.
            else -> {
                Log.w(TAG, "Location settings check failed unexpectedly", error)
                report(true)
            }
        }
    }

    private fun report(enabled: Boolean) {
        isEnabled = enabled
        onResult(enabled)
    }

    internal companion object {
        private const val TAG = "LocationSettingsState"

        /**
         * Balanced priority only requires the device's location switch to be on. Using
         * high accuracy here would also nag about GPS / "improve accuracy" modes.
         */
        private val SETTINGS_REQUEST: LocationSettingsRequest =
            LocationSettingsRequest.Builder()
                .addLocationRequest(
                    LocationRequest.Builder(
                        Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                        LOCATION_UPDATE_INTERVAL_MS
                    ).build()
                )
                .build()

        /** Persists `active` across rotation so resume re-checks keep working. */
        fun saver(activity: Activity) = listSaver<LocationSettingsState, Boolean>(
            save = { listOf(it.active) },
            restore = { saved -> LocationSettingsState(activity).apply { active = saved[0] } }
        )
    }
}