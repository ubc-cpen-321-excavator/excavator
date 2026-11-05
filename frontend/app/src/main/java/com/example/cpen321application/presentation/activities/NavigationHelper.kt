package com.example.cpen321application.presentation.activities

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.activities.dashboard.DashboardActivity
import com.example.cpen321application.presentation.activities.discovery.DiscoveryActivity
import com.example.cpen321application.presentation.activities.favorites.FavoritesActivity
import com.example.cpen321application.presentation.activities.signin.SigninActivity

// Keys shared by the sender (here) and whichever activity reads the data
object GemExtras {
    const val TITLE = "gem_title"
    const val LATITUDE = "gem_coords_latitude"
    const val LONGITUDE = "gem_coords_longitude"
    const val PLACES_NAME = "gem_places_name"
}

fun navigateTo(
    context: Context,
    destination: NavDestination,
    extras: Bundle? = null
) {
    val target: Class<out Activity>? = when (destination) {
        NavDestination.DASHBOARD -> DashboardActivity::class.java
        NavDestination.DISCOVERY -> DiscoveryActivity::class.java
        NavDestination.FAVORITES -> FavoritesActivity::class.java
    }

    if (target == null) {
        Toast.makeText(context, "${destination.description} is coming soon", Toast.LENGTH_SHORT).show()
        return
    }

    val intent = Intent(context, target)
        .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    if (extras != null) intent.putExtras(extras)
    context.startActivity(intent)
}

fun navigateToDiscovery(context: Context, gem: Gem? = null) {
    val extras = gem?.let {
        Bundle().apply {
            putString(GemExtras.TITLE, it.title)
            putDouble(GemExtras.LATITUDE, it.coords.latitude)
            putDouble(GemExtras.LONGITUDE, it.coords.longitude)
            putString(GemExtras.PLACES_NAME, it.placesName)
        }
    }
    navigateTo(context, NavDestination.DISCOVERY, extras)
}

fun navigateToSignin(context: Context) {
    context.startActivity(
        Intent(context, SigninActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    )
}