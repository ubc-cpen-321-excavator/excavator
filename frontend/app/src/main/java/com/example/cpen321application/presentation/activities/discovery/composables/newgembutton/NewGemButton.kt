package com.example.cpen321application.presentation.activities.discovery.composables.newgembutton

import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.example.cpen321application.R
import com.example.cpen321application.presentation.viewmodels.GemEvent


@Composable
fun NewGemButton(modifier: Modifier, onClick: (GemEvent) -> Unit){

    FilledIconButton(
        onClick = {},
        modifier = modifier.navigationBarsPadding().padding(16.dp).scale(1.5f),
    ) {
        Icon(
            painter = painterResource(R.drawable.baseline_add_circle_120),
            contentDescription = "do ts later",
        )
    }

}