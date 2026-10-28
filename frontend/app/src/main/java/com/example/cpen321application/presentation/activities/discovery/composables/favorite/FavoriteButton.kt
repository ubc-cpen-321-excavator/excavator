package com.example.cpen321application.presentation.activities.discovery.composables.favorite

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.example.cpen321application.R

@Composable
fun FavoriteButton() {

    var checked by remember {mutableStateOf(false)}

    IconButton(
        onClick = {checked = !checked}
    ) {
        Icon(
            painter = painterResource(R.drawable.baseline_star_24),
            contentDescription = stringResource(R.string.favorites_description),
            modifier = Modifier.padding(16.dp).scale(3f),
            tint = if (checked) Color(red=200, green=200, blue=0) else Color.Gray
        )
    }

}