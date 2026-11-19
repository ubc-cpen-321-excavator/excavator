package com.example.cpen321application.presentation.activities.dashboard.composables

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.example.cpen321application.utils.location.rememberLocationSettingsState
import com.example.cpen321application.utils.permissions.LocationAccess
import com.example.cpen321application.utils.permissions.composables.LocationPermissionRejectionDialog
import com.example.cpen321application.utils.permissions.rememberLocationPermissionState

@Composable
fun LocationChecker (
    viewModel: GemViewModel = hiltViewModel()
){
    // Two independent blocking states. Both use the same retry-or-close dialog.
    var showRejectionDialog by rememberSaveable { mutableStateOf(false) }
    var showLocationOffDialog by rememberSaveable { mutableStateOf(false) }

    // Step 2 of the flow: the device's Location switch. Declared before the
    // permission state because the permission callback triggers it.
    val locationSettings = rememberLocationSettingsState { enabled ->
        showLocationOffDialog = !enabled
    }

    // Step 1 of the flow: runtime permission.
    val locationPermission = rememberLocationPermissionState { access ->
        viewModel.onLocationAccess(access)

        when (access) {
            LocationAccess.DENIED -> {
                // Both denied (or user dismissed the rationale / Settings prompt).
                showRejectionDialog = true
                showLocationOffDialog = false
            }

            else -> {
                showRejectionDialog = false
                // Permission is fine; now make sure location is actually switched on.
                locationSettings.request()
            }
        }
    }

    if (showRejectionDialog) {
        LocationPermissionRejectionDialog(
            onRetry = {
                showRejectionDialog = false
                locationPermission.request()
            }
        )
    }

    if (showLocationOffDialog) {
        LocationPermissionRejectionDialog(
            onRetry = {
                showLocationOffDialog = false
                locationSettings.request()
            },
            title = "Location is turned off",
            message = "This app needs your device's location to be switched on. " +
                    "Please turn it on to continue, or close the app.",
            retryLabel = "Turn on location"
        )
    }

    // Request once per launch. rememberSaveable stops rotation from
    // re-triggering the request (and resetting the anti-nag flags).
    var hasRequestedLocation by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (!hasRequestedLocation) {
            hasRequestedLocation = true
            // Checks precise first; only asks the user if it isn't already granted.
            locationPermission.request()
        }
    }
}