package com.example.cpen321application

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.presentation.viewmodels.GemGridEvent
import com.example.cpen321application.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.model.LatLng
import dagger.hilt.android.AndroidEntryPoint


@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val coord = LatLng(1.35,103.87)

        setContent {
            CPEN321ApplicationTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    GemList(modifier = Modifier.padding(innerPadding))

                    // To be refactored, simply here to try out the google maps features
//                    GoogleMap(
//                        modifier=Modifier.fillMaxSize(),
//                        cameraPositionState = rememberCameraPositionState {
//                            position= CameraPosition.fromLatLngZoom(coord, 10f)
//                        }
//                    ){
//                        Marker(
//                            state= rememberUpdatedMarkerState(position= coord),
//                            title="THIS IS A TITLE",
//                            snippet = "THIS IS A SNIPPET"
//                        )
//                    }


//                    Greeting(
//                        apiBaseUrl = BuildConfig.API_BASE_URL,
//                        modifier = Modifier.padding(innerPadding)
//                    )
                }
            }
        }
    }
}


// State hoisting to separate state from UI
// with GemList and GemList Content
// This comment will be removed after documentation
// has been written outlining frontend architecture
@Composable
fun GemList(
    modifier: Modifier = Modifier,
    viewModel: GemViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    GemListContent(uiState, viewModel::onEvent)
}

@Composable
fun GemListContent (
    uiState: List<Gem>,
    onEvent: (GemGridEvent) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {

        Button(
            onClick = { onEvent(GemGridEvent.AddGem("New Gem from button")) })
        {
            Text("Add gem")
        }

        LazyColumn() {

            items(uiState) { gem ->
                GemCard(gem)
            }
        }
    }
}

@Composable
fun GemCard(
    gem: Gem,
    modifier: Modifier = Modifier
) {
    Card(modifier = Modifier
        .fillMaxSize()
        .padding(16.dp)
    ) {
        Column() {

            Text(text = gem.title, modifier = Modifier
                .fillMaxSize()
                , textAlign = TextAlign.Center
            )

            Text(text = gem.dateTimeCreated.toString(), modifier = Modifier
                .fillMaxSize()
                , textAlign = TextAlign.Center
            )
        }

    }
}

