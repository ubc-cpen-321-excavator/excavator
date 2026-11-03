package com.example.cpen321application.presentation.activities

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.presentation.activities.dashboard.DashboardActivity
import com.example.cpen321application.presentation.activities.discovery.DiscoveryActivity

// Keys shared by the sender (here) and whichever activity reads the data
object GemExtras {
    const val TITLE = "gem_title"
    const val COORDS = "gem_coords"
}

fun navigateTo(
    context: Context,
    destination: NavDestination,
    extras: Bundle? = null
) {
    val target: Class<out Activity>? = when (destination) {
        NavDestination.DASHBOARD -> DashboardActivity::class.java
        NavDestination.DISCOVERY -> DiscoveryActivity::class.java
        NavDestination.FAVORITES -> null // TODO: add FavoritesActivity when it exists
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
            putParcelable(GemExtras.COORDS, it.coords)
        }
    }
    navigateTo(context, NavDestination.DISCOVERY, extras)
}