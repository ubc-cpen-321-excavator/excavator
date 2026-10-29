package com.example.cpen321application.presentation.activities.discovery.composables

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.CAMERA_INIT_ZOOM_FACTOR
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.CAMERA_PAN_DURATION_MS
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.INITIAL_COORDINATES
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.PLACEHOLDER_SELECTED_GEM
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.GemInfoSheetContent
import com.example.cpen321application.presentation.activities.discovery.composables.gemmarker.GemMarker
import com.example.cpen321application.presentation.activities.discovery.composables.newgembutton.NewGemButton
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.rememberCameraPositionState


@Composable
fun DiscoveryMap(
    viewModel: GemViewModel = hiltViewModel()
) {

    val gems by viewModel.uiState.collectAsState()

    var showGemInfoSheet by remember {mutableStateOf(false)}

    var selectedGem by remember {mutableStateOf(
        PLACEHOLDER_SELECTED_GEM
    )}

    // Placeholder coordinates
    val coord = INITIAL_COORDINATES

    Box(modifier = Modifier.fillMaxSize()){

        val cameraPositionState = rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coord, CAMERA_INIT_ZOOM_FACTOR)
        }

        GoogleMap (
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraPositionState
        ) {

            gems.forEach { gem ->
                GemMarker(
                    gem,
                    onSelectedGemChange = {selectedGem = it},
                    onGemSheetVisibilityChange = {showGemInfoSheet = it},
                    onCameraReposition = {
                        cameraPositionState.animate(
                            update=CameraUpdateFactory.newLatLng(it),
                            durationMs= CAMERA_PAN_DURATION_MS
                        )
                    }
                )
            }

            GemInfoSheetContent(
                gem = selectedGem,
                {showGemInfoSheet = it},
                showGemInfoSheet
            )

        }

        NewGemButton(Modifier.align(Alignment.BottomStart), onClick = viewModel::onEvent)
    }


}

@Preview
@Composable
fun DiscoveryMapPreview() {
    DiscoveryMap()
}

