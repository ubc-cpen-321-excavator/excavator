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
import androidx.compose.material3.Card
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.viewmodels.GemViewModel
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState
import dagger.hilt.android.AndroidEntryPoint
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext


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
                    GoogleMap(
                        modifier=Modifier.fillMaxSize(),
                        cameraPositionState = rememberCameraPositionState {
                            position= CameraPosition.fromLatLngZoom(coord, 10f)
                        }
                    ){
                        Marker(
                            state= rememberUpdatedMarkerState(position= coord),
                            title="THIS IS A TITLE",
                            snippet = "THIS IS A SNIPPET"
                        )
                    }


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

    GemListContent(uiState)
}

@Composable
fun GemListContent (
    uiState: List<Gem>
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
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
        Text(text = gem.title, modifier = Modifier
            .fillMaxSize()
            , textAlign = TextAlign.Center
        )
    }
}

// Keep for later in case, remove once retrofit
// has been set up
@Composable
fun Greeting(apiBaseUrl: String, modifier: Modifier = Modifier) {
    var statusText by remember { mutableStateOf("Checking backend at $apiBaseUrl/health...") }

    LaunchedEffect(apiBaseUrl) {
        statusText = fetchHealthStatus(apiBaseUrl)
    }

    Text(
        text = statusText,
        modifier = modifier
    )
}

private suspend fun fetchHealthStatus(apiBaseUrl: String): String = withContext(Dispatchers.IO) {
    val healthUrl = "${apiBaseUrl.trimEnd('/')}/health"
    try {
        val connection = (URL(healthUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 5_000
            readTimeout = 5_000
        }

        when (val code = connection.responseCode) {
            HttpURLConnection.HTTP_OK -> {
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                "Backend healthy ($healthUrl): $body"
            }
            else -> {
                val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() }
                "Backend error ($healthUrl): HTTP $code${errorBody?.let { " — $it" } ?: ""}"
            }
        }
    } catch (e: Exception) {
        "Backend unreachable ($healthUrl): ${e.message ?: e.javaClass.simpleName}"
    }
}