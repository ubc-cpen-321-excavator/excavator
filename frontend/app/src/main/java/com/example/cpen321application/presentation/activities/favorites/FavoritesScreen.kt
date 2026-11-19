package com.example.cpen321application.presentation.activities.favorites

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.cpen321application.presentation.activities.NavBar
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.dashboard.composables.GemCardGrid
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.presentation.viewmodels.GemViewModel


@Composable
fun FavoritesScreen(
    viewModel: GemViewModel = hiltViewModel()
) {
    val context = LocalContext.current

    val favoriteGemState by viewModel.favoriteGems.collectAsStateWithLifecycle()

    LifecycleStartEffect(Unit) {
        viewModel.getFavoriteGems()
        onStopOrDispose {  }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavBar(
                current = NavDestination.FAVORITES,
                onNavigate = { navigateTo(context, it) }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            Text("Favorites", fontSize = 30.sp)
            GemCardGrid(
                gemState = favoriteGemState,
                context = context,
                title = "Your favorites:",
                isFavorite = true,
                onGemLongClick = { viewModel.deleteFavoriteGem(it.placesName.removePrefix("places/")) }
            )
        }
    }
}
