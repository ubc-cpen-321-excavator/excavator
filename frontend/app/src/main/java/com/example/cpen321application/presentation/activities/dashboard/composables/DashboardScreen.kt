package com.example.cpen321application.presentation.activities.dashboard.composables

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.presentation.viewmodels.GemViewModel

@Composable
fun DashboardScreen(
    modifier: Modifier,
    viewModel: GemViewModel = hiltViewModel()
) {

    LaunchedEffect(Unit) {
        viewModel.getFavoriteGems()
    }

    Column(modifier = modifier) {
        Text("Dashboard", fontSize = 30.sp)
        LatestGemsGrid(
            modifier,
            context = LocalContext.current
        )
    }
}
