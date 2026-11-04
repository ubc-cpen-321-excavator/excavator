package com.example.cpen321application.presentation.activities.dashboard

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.sp
import com.example.cpen321application.presentation.activities.NavBar
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.dashboard.composables.LatestGemsGrid
import com.example.cpen321application.presentation.activities.dashboard.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.utils.auth.AuthenticatedActivity
import com.example.cpen321application.utils.permissions.LocationAccess
import com.example.cpen321application.utils.permissions.composables.LocationPermissionRejectionDialog
import com.example.cpen321application.utils.permissions.rememberLocationPermissionState
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class DashboardActivity : AuthenticatedActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CPEN321ApplicationTheme {
                val context = LocalContext.current

                var showRejectionDialog by rememberSaveable {mutableStateOf(false) }


                val locationPermission = rememberLocationPermissionState { access ->
                    showRejectionDialog = when (access) {

                        LocationAccess.DENIED -> {
                            // Both denied (or user dismissed the rationale / Settings prompt):
                            // disable location features and offer a manual location fallback.
                            true
                        }

                        else -> {
                            false
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

