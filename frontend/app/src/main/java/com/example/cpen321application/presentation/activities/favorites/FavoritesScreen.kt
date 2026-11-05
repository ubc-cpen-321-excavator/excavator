package com.example.cpen321application.presentation.activities.favorites

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
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.activities.NavBar
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.dashboard.composables.GemCardGrid
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.ui.theme.CPEN321ApplicationTheme
import com.google.android.gms.maps.model.LatLng

// Hardcoded for now; real favorites will come from the API later
private val hardcodedFavorites = listOf(
    Gem("Nitobe Memorial Garden", LatLng(49.2663, -123.2599), "places/seed-nitobe-garden"),
    Gem("Museum of Anthropology", LatLng(49.2692, -123.2599), "places/seed-moa")
)

@Composable
fun FavoritesScreen(gems: List<Gem> = hardcodedFavorites) {
    val context = LocalContext.current

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
                gems = gems,
                context = context,
                title = "Your favorites:",
                isFavorite = true,
                onGemLongClick = { /* TODO: favorites long-press action */ }
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun FavoritesScreenPreview() {
    CPEN321ApplicationTheme {
        FavoritesScreen()
    }
}