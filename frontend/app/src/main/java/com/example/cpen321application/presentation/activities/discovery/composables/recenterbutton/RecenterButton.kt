package com.example.cpen321application.presentation.activities.discovery.composables.recenterbutton

import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.example.cpen321application.R
import kotlin.coroutines.cancellation.CancellationException

@Composable
fun RecenterButton(
    modifier: Modifier = Modifier,
    onClick: suspend () -> Unit,
){

    var activated by remember { mutableStateOf(false) }

    LaunchedEffect(activated) {

        if (activated) {
            try {
                onClick()
            } catch (e: CancellationException){
                // CancellationException is thrown by the map animation function and must be
                // caught to prevent the app from crashing if the recenter button is pressed again
                // before the animation is completed
            } finally {
                activated = false
            }
        }

    }

    FilledIconButton(
        onClick = {
            activated = true
        },
        modifier = modifier.navigationBarsPadding().padding(16.dp).scale(1.5f),
    ) {
        Icon(
            painter = painterResource(R.drawable.recenter_button_24),
            contentDescription = "Recenter to your location",
        )
    }
}