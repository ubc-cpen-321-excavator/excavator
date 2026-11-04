package com.example.cpen321application.presentation.activities.discovery.composables

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.cpen321application.presentation.activities.discovery.GemRequest
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.BUILDING_LEVEL_ZOOM
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.CAMERA_INIT_ZOOM_FACTOR
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.CAMERA_PAN_DURATION_MS
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.PLACEHOLDER_COORDINATES
import com.example.cpen321application.presentation.activities.discovery.composables.constants.Constants.Companion.PLACEHOLDER_SELECTED_GEM
import com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.GemCreationSheet
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.GemInfoSheetContent
import com.example.cpen321application.presentation.activities.discovery.composables.gemmarker.GemMarker
import com.example.cpen321application.presentation.activities.discovery.composables.newgembutton.NewGemButton
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState


@Composable
fun DiscoveryMap(
    gemRequest: GemRequest,
    viewModel: GemViewModel = hiltViewModel()
) {

    val gems by viewModel.uiState.collectAsState()
    val coordinates by viewModel.coordinates.collectAsStateWithLifecycle()

    var showGemInfoSheet by remember {mutableStateOf(false)}
    var showNewGemSheet by remember {mutableStateOf(false)}
    var selectedGem by remember {mutableStateOf(PLACEHOLDER_SELECTED_GEM)}

    // Has the camera already been auto-positioned (on the user, or on a requested gem)?
    // Starts true when we were opened for a specific gem, so the user's fix never
    // overrides it. rememberSaveable so rotation doesn't re-center the map.
    var hasCenteredCamera by rememberSaveable { mutableStateOf(gemRequest.gem != null) }

    // null until the first real fix arrives (or while permission/location is unavailable).
    val userLatLng: LatLng? = coordinates?.let { LatLng(it.latitude, it.longitude) }

    // Only used as the camera's starting position, before we have a fix.
    val coord: LatLng = userLatLng ?: PLACEHOLDER_COORDINATES


    Box(modifier = Modifier.fillMaxSize()){

        val cameraPositionState = rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coord, CAMERA_INIT_ZOOM_FACTOR)
        }


        GemInfoSheetContent(
            gem = selectedGem,
            {showGemInfoSheet = it},
            showGemInfoSheet
        )

        GemCreationSheet(
            {showNewGemSheet = it},
            showNewGemSheet
        )

        GoogleMap (
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraPositionState
        ) {

            // Reacts to the gem the screen was opened for (or its absence).
            LaunchedEffect(gemRequest) {

                val gem = gemRequest.gem

                showGemInfoSheet = gem != null
                selectedGem = gem ?: PLACEHOLDER_SELECTED_GEM

                if (gem != null) {
                    // A requested gem takes priority: never auto-center on the user after this.
                    hasCenteredCamera = true
                    cameraPositionState.animate(
                        update = CameraUpdateFactory.newLatLngZoom(gem.coords, BUILDING_LEVEL_ZOOM),
                        durationMs = CAMERA_PAN_DURATION_MS
                    )
                }
            }

            // Reacts to the user's location. Keyed on userLatLng so it runs again when the
            // first real fix arrives, which is after the effect above has already run.
            // (Previously the centering lived in the gemRequest effect, which only ran once,
            // at first composition, while `coord` was still the placeholder.)
            LaunchedEffect(userLatLng) {
                val target = userLatLng ?: return@LaunchedEffect

                if (!hasCenteredCamera) {
                    hasCenteredCamera = true
                    cameraPositionState.animate(
                        update = CameraUpdateFactory.newLatLngZoom(target, CAMERA_INIT_ZOOM_FACTOR),
                        durationMs = CAMERA_PAN_DURATION_MS
                    )
                }
            }


            userLatLng?.let { position ->
                Marker(
                    state = rememberUpdatedMarkerState(position),
                    title = "Your Location",
                )
            }

            gems.forEach { gem ->
                GemMarker(
                    gem,
                    onSelectedGemChange = {selectedGem = gem},
                    onGemSheetVisibilityChange = {showGemInfoSheet = true},
                    onCameraReposition = {
                        cameraPositionState.animate(
                            update=CameraUpdateFactory.newLatLng(gem.coords),
                            durationMs= CAMERA_PAN_DURATION_MS
                        )
                    }
                )
            }
        }

        NewGemButton(Modifier.align(Alignment.BottomStart), onClick = viewModel::onEvent){
            showNewGemSheet=true
        }
    }


}