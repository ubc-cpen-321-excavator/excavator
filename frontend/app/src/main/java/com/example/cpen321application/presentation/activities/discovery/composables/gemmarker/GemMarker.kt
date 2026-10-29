package com.example.cpen321application.presentation.activities.discovery.composables.gemmarker

import androidx.compose.runtime.Composable
import com.example.cpen321application.R
import com.example.cpen321application.data.entities.Gem
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberUpdatedMarkerState

@Composable
fun GemMarker (
    gem: Gem,
    onSelectedGemChange: (Gem) -> Unit,
    onGemSheetVisibilityChange: (Boolean) -> Unit
) {
    Marker(
        state = rememberUpdatedMarkerState(gem.coords),
        title = "Sample",
        snippet = "Snippet",
        icon = BitmapDescriptorFactory.fromResource(R.drawable.outline_diamond_24),
        onClick = {
            onSelectedGemChange(gem)
            onGemSheetVisibilityChange(true)
            true
        }
    )
}



