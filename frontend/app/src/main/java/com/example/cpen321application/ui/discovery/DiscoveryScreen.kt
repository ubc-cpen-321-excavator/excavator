package com.example.cpen321application.ui.discovery

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.example.cpen321application.R
import com.example.cpen321application.model.Gem
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState

/** Where the camera starts before the user's location is known: the UBC Vancouver campus. */
private const val DEFAULT_LATITUDE = 49.2606
private const val DEFAULT_LONGITUDE = -123.2460
private const val DEFAULT_ZOOM = 14f

/** Street-level zoom used once the map is centered on the user. */
private const val USER_LOCATION_ZOOM = 16f

/**
 * Discovery screen: a full-screen Google Map with one pin per gem.
 *
 * - Asks for location permission once, then centers the camera on the user.
 * - Tapping a pin opens [GemDetailsSheet] instead of the Maps SDK's built-in info window.
 *
 * @param contentPadding system bar insets; the map keeps its buttons and Google logo clear of them.
 * @param gems the gems to show as pins.
 */
@Composable
fun DiscoveryScreen(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
    gems: List<Gem> = sampleGems,
) {
    val context = LocalContext.current
    var hasLocationPermission by remember { mutableStateOf(context.hasLocationPermission()) }
    var hasRequestedPermission by rememberSaveable { mutableStateOf(false) }
    var hasCenteredOnUser by rememberSaveable { mutableStateOf(false) }
    var selectedGemId by rememberSaveable { mutableStateOf<String?>(null) }
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(DEFAULT_LATITUDE, DEFAULT_LONGITUDE), DEFAULT_ZOOM)
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        hasLocationPermission = grants.values.any { granted -> granted }
    }

    // Ask for location permission the first time this screen is shown (not again after a rotation).
    LaunchedEffect(Unit) {
        if (!hasLocationPermission && !hasRequestedPermission) {
            hasRequestedPermission = true
            permissionLauncher.launch(locationPermissions)
        }
    }

    // Once permission is granted, move the camera to the user's current location (only once, so we
    // don't yank the map back if the user has panned away and then rotates the phone).
    LaunchedEffect(hasLocationPermission) {
        if (hasLocationPermission && !hasCenteredOnUser) {
            context.getCurrentLatLng()?.let { userLocation ->
                cameraPositionState.animate(CameraUpdateFactory.newLatLngZoom(userLocation, USER_LOCATION_ZOOM))
                hasCenteredOnUser = true
            }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        DiscoveryMap(
            gems = gems,
            cameraPositionState = cameraPositionState,
            showUserLocation = hasLocationPermission,
            contentPadding = contentPadding,
            onGemClick = { gem -> selectedGemId = gem.id },
        )
        if (hasRequestedPermission && !hasLocationPermission) {
            LocationDeniedBanner(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(contentPadding),
            )
        }
    }

    gems.find { it.id == selectedGemId }?.let { selectedGem ->
        GemDetailsSheet(gem = selectedGem, onDismiss = { selectedGemId = null })
    }
}

/**
 * The Google Map itself, with one [Marker] per gem.
 *
 * [onGemClick] is the pin-tap callback. The Marker's `onClick` returns `true` to tell the Maps SDK we handled the
 * tap, which turns off its default behaviour (opening the built-in info window with the title and snippet, and
 * moving the camera to the pin). Returning `false` instead would show that built-in popup.
 */
@Composable
private fun DiscoveryMap(
    gems: List<Gem>,
    cameraPositionState: CameraPositionState,
    showUserLocation: Boolean,
    contentPadding: PaddingValues,
    onGemClick: (Gem) -> Unit,
    modifier: Modifier = Modifier,
) {
    // isMyLocationEnabled must stay false until permission is granted, or the Maps SDK throws a SecurityException.
    val mapProperties = remember(showUserLocation) { MapProperties(isMyLocationEnabled = showUserLocation) }
    val mapUiSettings = remember(showUserLocation) { MapUiSettings(myLocationButtonEnabled = showUserLocation) }

    GoogleMap(
        modifier = modifier.fillMaxSize(),
        cameraPositionState = cameraPositionState,
        contentDescription = stringResource(R.string.discovery_map_description),
        properties = mapProperties,
        uiSettings = mapUiSettings,
        contentPadding = contentPadding,
    ) {
        gems.forEach { gem ->
            key(gem.id) {
                Marker(
                    state = rememberUpdatedMarkerState(position = gem.toLatLng()),
                    contentDescription = gem.name,
                    title = gem.name,
                    snippet = gem.description,
                    onClick = {
                        onGemClick(gem)
                        true
                    },
                )
            }
        }
    }
}

/** Shown at the top of the map when location access is denied, so the user knows why the map isn't on them. */
@Composable
private fun LocationDeniedBanner(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.padding(all = 16.dp),
        shape = MaterialTheme.shapes.medium,
        tonalElevation = 4.dp,
        shadowElevation = 4.dp,
    ) {
        Text(
            text = stringResource(R.string.discovery_location_denied),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun Gem.toLatLng(): LatLng = LatLng(latitude, longitude)
