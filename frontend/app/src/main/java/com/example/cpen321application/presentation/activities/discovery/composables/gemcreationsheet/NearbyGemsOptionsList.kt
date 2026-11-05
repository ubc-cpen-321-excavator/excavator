package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.data.remote.NewGemRequestBody
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.model.LatLng

@Composable
fun NearbyGemsOptionsList (
    modifier: Modifier = Modifier,
    viewModel: GemViewModel = hiltViewModel(),
    onOptionsClosed: (Boolean) -> Unit
) {

    val uiState by viewModel.gemCandidate.collectAsState()

    if (uiState.isNotEmpty()) {
        LazyColumn(
            modifier = modifier.fillMaxWidth()
        ) {

            uiState.forEach { gemCandidate ->
                item {
                    NearbyGemOptionCard(gemCandidate) {
                        viewModel.addGem(
                            it.name, LatLng(it.latitiude, it.longitude)
                        )
                        onOptionsClosed(false)
                    }
                }
            }
        }
    } else {
        Column {
            Text("No gem candididates found! Check back later")
            Button(
                onClick = {onOptionsClosed(false)}
            ) {
                Text("Ok")
            }
        }

    }

}

