package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.domain.models.Gem

@Composable
fun NearbyGemOptionCard(
    gemCandidate: GemCandidate
) {

    Card(modifier = Modifier.fillMaxWidth().padding(8.dp)) {
        Text(
            gemCandidate.displayName
        )
    }

}