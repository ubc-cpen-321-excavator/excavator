package com.example.cpen321application.presentation.activities.dashboard

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import com.example.cpen321application.presentation.activities.NavBar
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.dashboard.composables.LatestGemsGrid
import com.example.cpen321application.presentation.activities.dashboard.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.example.cpen321application.utils.auth.AuthenticatedActivity
import com.example.cpen321application.utils.location.rememberLocationSettingsState
import com.example.cpen321application.utils.permissions.LocationAccess
import com.example.cpen321application.utils.permissions.composables.LocationPermissionRejectionDialog
import com.example.cpen321application.utils.permissions.rememberLocationPermissionState
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class DashboardActivity : AuthenticatedActivity() {


    private val gemViewModel: GemViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        setContent {
            CPEN321ApplicationTheme {
                val context = LocalContext.current

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
                    gemViewModel.onLocationAccess(access)

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

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        NavBar(
                            current = NavDestination.DASHBOARD,
                            onNavigate = { navigateTo(context, it) }
                        )
                    }
                ) { innerPadding ->

                    Column(modifier = Modifier.padding(innerPadding)) {
                        Text("Dashboard", fontSize = 30.sp)
                        LatestGemsGrid(
                            Modifier.padding(innerPadding),
                            context = LocalContext.current
                        )
                    }
                }
            }
        }
    }
}