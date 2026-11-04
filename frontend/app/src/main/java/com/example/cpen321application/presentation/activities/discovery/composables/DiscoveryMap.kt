package com.example.cpen321application.presentation.activities.discovery.composables

import android.util.Log
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
import androidx.compose.ui.graphics.Color
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.cpen321application.presentation.activities.discovery.GemRequest
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
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.Circle
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch


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


    LaunchedEffect(gemRequest) {
        val gem = gemRequest.gem

        showGemInfoSheet = gem != null
        selectedGem = gem ?: PLACEHOLDER_SELECTED_GEM
    }


    val userLatLng: LatLng? = coordinates?.let { LatLng(it.latitude, it.longitude) }

    val coord: LatLng = userLatLng ?: PLACEHOLDER_COORDINATES


    Box(modifier = Modifier.fillMaxSize()){

        val cameraPositionState = rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coord, CAMERA_INIT_ZOOM_FACTOR)
        }

        // Center on the user ONCE, on the first real fix. Re-centering on every update
        // (every few seconds) would cancel the gem pan animation below and yank the map
        // back while the user is panning it. If we were opened for a specific gem, never
        // auto-center. For continuous follow, drop this flag and animate on every change.
        var hasCenteredOnUser by rememberSaveable { mutableStateOf(gemRequest.gem != null) }
        LaunchedEffect(userLatLng) {
            val target = userLatLng ?: return@LaunchedEffect
            if (!hasCenteredOnUser) {
                hasCenteredOnUser = true
                cameraPositionState.animate(
                    update = CameraUpdateFactory.newLatLngZoom(target, CAMERA_INIT_ZOOM_FACTOR),
                    durationMs = CAMERA_PAN_DURATION_MS
                )
            }
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

            LaunchedEffect(gemRequest) {
                val gem = gemRequest.gem

                if (gemRequest.gem != null) {
                    cameraPositionState.animate(
                        update = CameraUpdateFactory.newLatLng(gem.coords),
                        durationMs = CAMERA_PAN_DURATION_MS
                    )
                }
            }

            // TODO: Change this to use a special marker with a custom image
            // that indicate to the user where they are

            // Visible, live indicator of the position coming from GemViewModel.
            // Moves every time a new fix arrives, independent of the camera.
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