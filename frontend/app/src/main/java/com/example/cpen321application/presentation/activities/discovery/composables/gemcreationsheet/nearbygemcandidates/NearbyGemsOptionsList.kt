package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.nearbygemcandidates

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.cpen321application.presentation.viewmodels.GemViewModel
import com.google.android.gms.maps.model.LatLng

@Composable
fun NearbyGemsOptionsList (
    modifier: Modifier = Modifier,
    viewModel: GemViewModel = hiltViewModel(),
    onOptionsClosed: (Boolean) -> Unit
) {

    val gemCandidateState by viewModel.gemCandidate.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.getGemCandidates()
    }

    // TODO: make viewmodel call GetGemCandidiates and see if that will cause new gems to appear

    if (gemCandidateState.errorMessage != null) {
        NoGemCandidateDisplay(
            message = gemCandidateState.errorMessage!!
        ) { onOptionsClosed(it)}
    } else if (gemCandidateState.data.isNotEmpty()) {
        LazyColumn(
            modifier = modifier.fillMaxWidth()
        ) {

            gemCandidateState.data.forEach { gemCandidate ->
                item {
                    NearbyGemOptionCard(gemCandidate) {
                        viewModel.addGem(
                            it.name, LatLng(it.latitude, it.longitude)
                        )
                        onOptionsClosed(false)
                    }
                }
            }
        }
    } else {
        Column {

            NoGemCandidateDisplay(
                message = "No gem candididates found! Check back later"
            ) { onOptionsClosed(it) }
        }
    }
}

@Composable
fun NoGemCandidateDisplay(
    modifier: Modifier = Modifier,
    message: String,
    onDismiss: (Boolean) -> Unit
){
    Column {
        Text(message)
        Button(
            onClick = {onDismiss(false)}
        ) {
            Text("Ok")
        }
    }
}

