package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.localrating

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun GemRatingOptions(
    modifier: Modifier = Modifier,
    onRatingSubmit: () -> Unit,
    onRatingCancel: () -> Unit
){

    Row (modifier = modifier){

        RatingCancelButton(Modifier.padding(16.dp)) {
            onRatingCancel()
        }

        RatingSubmitButton(Modifier.padding(16.dp)) {
            onRatingSubmit()
        }

    }
}

@Composable
fun RatingSubmitButton(
    modifier: Modifier = Modifier,
    onRatingSubmit: () -> Unit
){
    Button(
        onClick = onRatingSubmit,
        modifier = modifier
    ) {
        Text("Submit")
    }
}

@Composable
fun RatingCancelButton(
    modifier: Modifier = Modifier,
    onRatingCancel: () -> Unit
){
    Button(
        onClick = onRatingCancel,
        modifier = modifier
    ) {
        Text("Cancel")
    }
}