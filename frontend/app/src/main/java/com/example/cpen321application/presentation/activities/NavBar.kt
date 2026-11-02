package com.example.cpen321application.presentation.activities

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
//import androidx.navigation.NavDestination
//commenting out to try to fix
import com.example.cpen321application.R


enum class NavDestination(val iconResourceID: Int, val description: String) {
    DASHBOARD(R.drawable.menu_24, "Dashboard"),
    DISCOVERY(R.drawable.place_24, "Discovery"),
    FAVORITES(R.drawable.star_banner_24, "Favorites")
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
                        painter = painterResource(destination.iconResourceID),
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