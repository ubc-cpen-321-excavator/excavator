package com.example.cpen321application.presentation.activities

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.tooling.preview.Preview

enum class NavDestination(val icon: ImageVector, val description: String) {
    DASHBOARD(Icons.Filled.Menu, "Dashboard"),
    DISCOVERY(Icons.Filled.Place, "Discovery"),
    FAVORITES(Icons.Filled.Star, "Favorites")
}

@Composable
fun NavBar(
    current: NavDestination,
    onNavigate: (NavDestination) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(modifier = modifier) {
        NavDestination.entries.forEach { destination ->
            NavigationBarItem(
                selected = current == destination,
                onClick = {
                    // Spec: if already on this screen, do nothing
                    if (current != destination) onNavigate(destination)
                },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.description
                    )
                }
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun NavBarPreview() {
    NavBar(current = NavDestination.DASHBOARD, onNavigate = {})
}

@Preview(showBackground = true, heightDp = 400)
@Composable
fun NavBarInScaffoldPreview() {
    Scaffold(
        bottomBar = { NavBar(current = NavDestination.FAVORITES, onNavigate = {}) }
    ) { padding ->
        Box(Modifier.fillMaxSize().then(Modifier.padding(padding))) {
            Text("Screen content")
        }
    }
}