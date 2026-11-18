package com.example.cpen321application.presentation.activities.dashboard.composables

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.cpen321application.presentation.viewmodels.GemViewModel

@Composable
fun LatestGemsGrid(
    modifier: Modifier = Modifier,
    viewModel: GemViewModel = hiltViewModel(),
    context: Context
){
    val uiState by viewModel.newestGems.collectAsStateWithLifecycle()

    LifecycleStartEffect(Unit) {
        viewModel.getNewestGems()
        onStopOrDispose {  }
    }

    GemCardGrid(uiState,context,modifier,"Latest Gems:")


}