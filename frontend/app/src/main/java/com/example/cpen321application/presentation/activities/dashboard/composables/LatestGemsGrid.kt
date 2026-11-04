package com.example.cpen321application.presentation.activities.dashboard.composables

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.presentation.viewmodels.GemViewModel

@Composable
fun LatestGemsGrid(
    modifier: Modifier = Modifier,
    viewModel: GemViewModel = hiltViewModel(),
    context: Context
){
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.getNewestGems()
    }

    GemCardGrid(uiState,context,modifier,"Latest Gems:")


}