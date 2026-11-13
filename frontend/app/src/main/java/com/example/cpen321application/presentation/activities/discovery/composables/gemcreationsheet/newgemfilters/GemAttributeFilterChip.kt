package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.newgemfilters

import androidx.collection.MutableObjectList
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun GemAttributeFilterChip(label: String, currentFilters: MutableObjectList<String>) {

    var checked by remember { mutableStateOf(label in currentFilters) }

    FilterChip(selected = checked, onClick = {

        checked = !checked
        if (checked) currentFilters.add(label) else currentFilters.remove(label)},
        label={Text(label)},modifier= Modifier.padding(8.dp)
    )

}