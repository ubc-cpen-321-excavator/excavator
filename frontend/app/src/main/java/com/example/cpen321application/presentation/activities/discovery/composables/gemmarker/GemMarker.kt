package com.example.cpen321application.presentation.activities.discovery.composables.gemmarker

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.example.cpen321application.R
import com.example.cpen321application.data.entities.Gem
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberUpdatedMarkerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Dispatchers.Default
import kotlinx.coroutines.coroutineScope
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
        title = "Sample",
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



