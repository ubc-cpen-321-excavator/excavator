package com.example.cpen321application.presentation.activities

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.widget.Toast
import com.example.cpen321application.presentation.activities.dashboard.DashboardActivity
import com.example.cpen321application.presentation.activities.discovery.DiscoveryActivity

fun navigateTo(context: Context, destination: NavDestination) {
    val target: Class<out Activity>? = when (destination) {
        NavDestination.DASHBOARD -> DashboardActivity::class.java
        NavDestination.DISCOVERY -> DiscoveryActivity::class.java
        NavDestination.FAVORITES -> null
    //TODO: add FavoritesActivity when it exists
    }

    if (target == null) {
        Toast.makeText(context, "${destination.description} is coming soon", Toast.LENGTH_SHORT).show()
        return
    }

    context.startActivity(
        Intent(context, target).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    )
}