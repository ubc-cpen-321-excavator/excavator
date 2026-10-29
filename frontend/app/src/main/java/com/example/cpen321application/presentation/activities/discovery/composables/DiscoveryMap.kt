package com.example.cpen321application.presentation.activities.discovery.composables

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.GemInfoSheetContent
import com.example.cpen321application.presentation.activities.discovery.composables.gemmarker.GemMarker
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.rememberCameraPositionState


@Composable
fun DiscoveryMap(
    viewModel: GemViewModel = hiltViewModel()
) {

    val gems by viewModel.uiState.collectAsState()

    var showGemInfoSheet by remember {mutableStateOf(false)}

    var selectedGem by remember {mutableStateOf<Gem>(Gem(
        title = "Placeholder", coords = LatLng(1.0,1.0)
    ))}

    val coord = LatLng(12.12,12.12)

    GoogleMap (
        modifier = Modifier.fillMaxSize(),
        cameraPositionState = rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coord,10f)
        }
    ) {

        gems.forEach { gem ->
            GemMarker(
                gem,
                onSelectedGemChange = {selectedGem = it},
                onGemSheetVisibilityChange = {showGemInfoSheet = it}
            )
        }

        GemInfoSheetContent(
            gem = selectedGem,
            {showGemInfoSheet = it},
            showGemInfoSheet
        )

    }

}

@Preview
@Composable
fun DiscoveryMapPreview() {
    DiscoveryMap()
}

