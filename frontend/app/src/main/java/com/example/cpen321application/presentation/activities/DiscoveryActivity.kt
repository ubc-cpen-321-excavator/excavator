package com.example.cpen321application.presentation.activities

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.presentation.activities.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class DiscoveryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val coord = LatLng(12.12,33.444)

        setContent {
            CPEN321ApplicationTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->

                    Box(modifier = Modifier.fillMaxSize()){
                        DiscoveryMap()
                    }

                }
            }
        }
    }
}

@Composable
fun DiscoveryMap(
    viewModel: GemViewModel = hiltViewModel()
) {

   val uiState by viewModel.uiState.collectAsState()

    DiscoveryMapContent(uiState)

}

@Composable
fun DiscoveryMapContent(
    globalGemList: List<Gem> // To be changed later so not all gems are fetched
) {

    val coord = LatLng(34.34,43.43) // Placeholder for now
    var showBottomSheet by remember { mutableStateOf(false) }

    // TODO: Change this to use the primary key for the gem entity
    var selectedGemName by rememberSaveable{ mutableStateOf<String?>(null) }

    GoogleMap(
        modifier=Modifier.fillMaxSize(),
        cameraPositionState = rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coord, 10f)
        }
    ){

        globalGemList.forEach { gem ->
            Marker (
                state = rememberUpdatedMarkerState(position= LatLng(gem.latitude,gem.longitude)),
                title = gem.name,
                onClick = {
                    showBottomSheet = true
                    selectedGemName = gem.name
                    true
                }
            )
        }

        globalGemList.find { it.name == selectedGemName }?.let {
            GemDetailsSheet(it,{showBottomSheet=false})
        }

    }

}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GemDetailsSheet(
    gem: Gem,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
        ) {
            Text(text = gem.name, style = MaterialTheme.typography.headlineSmall)
            Spacer(modifier = Modifier.height(height = 8.dp))
            Text(text = gem.name, style = MaterialTheme.typography.bodyLarge)
        }
    }
}


