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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.sp
import com.example.cpen321application.presentation.activities.NavBar
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.dashboard.composables.LatestGemsGrid
import com.example.cpen321application.presentation.activities.dashboard.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.presentation.activities.navigateTo
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class DashboardActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CPEN321ApplicationTheme {
                val context = LocalContext.current

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

