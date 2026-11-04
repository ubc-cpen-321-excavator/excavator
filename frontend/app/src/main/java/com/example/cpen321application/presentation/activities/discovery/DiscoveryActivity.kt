package com.example.cpen321application.presentation.activities.discovery

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.activities.GemExtras
import com.example.cpen321application.presentation.activities.NavBar
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.discovery.composables.DiscoveryMap
import com.example.cpen321application.presentation.activities.discovery.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.utils.auth.AuthenticatedActivity
import com.google.android.gms.maps.model.LatLng
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class DiscoveryActivity : AuthenticatedActivity() {

    private var gemRequest by mutableStateOf(GemRequest(gem=null))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()


        if (savedInstanceState == null) {
            gemRequest = GemRequest(parseGem(intent))
        }


        setContent {
            CPEN321ApplicationTheme {
                val context = LocalContext.current


                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        NavBar(
                            current = NavDestination.DISCOVERY,
                            onNavigate = { navigateTo(context, it) }
                        )
                    }
                ) { innerPadding ->
                    Box(modifier = Modifier.padding(innerPadding)) {
                        DiscoveryMap(gemRequest)
                    }
                }
            }
        }
    }

    // Called when REORDER_TO_FRONT (or singleTop/singleTask) reuses this instance
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        gemRequest = GemRequest(parseGem(intent))
    }

}

data class GemRequest(
    val gem:Gem?,
    val id: Long = System.nanoTime()
)

private fun parseGem(intent: Intent?): Gem? {
    val extras = intent?.extras ?: return null
    val title = extras.getString(GemExtras.TITLE) ?: return null
    val placesName = extras.getString(GemExtras.PLACES_NAME) ?: return null
    if (!extras.containsKey(GemExtras.LATITUDE) || !extras.containsKey(GemExtras.LONGITUDE)) return null

    return Gem(
        title = title,
        coords = LatLng(
            extras.getDouble(GemExtras.LATITUDE),
            extras.getDouble(GemExtras.LONGITUDE)
        ),
        placesName = placesName
    )
}

