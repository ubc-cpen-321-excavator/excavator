package com.example.cpen321application.presentation.activities.discovery.composables.gemmarker

import androidx.compose.runtime.Composable
import com.example.cpen321application.R
import com.example.cpen321application.domain.models.Gem
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberUpdatedMarkerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Composable
fun GemMarker (
    gem: Gem,
    onSelectedGemChange: (Gem) -> Unit,
    onGemSheetVisibilityChange: (Boolean) -> Unit,
    onCameraReposition: suspend (LatLng) -> Unit
) {
    Marker(
        state = rememberUpdatedMarkerState(gem.coords),
        // The gem's name, so UI Automator can find this marker (markers are not Compose nodes).
        title = gem.title,
        snippet = "Snippet",
        icon = BitmapDescriptorFactory.fromResource(R.drawable.diamond_small),
        onClick = {
            onSelectedGemChange(gem)

            CoroutineScope(Dispatchers.Main).launch {
                onCameraReposition(gem.coords)
            }

            onGemSheetVisibilityChange(true)

            true
        }
    )
}



