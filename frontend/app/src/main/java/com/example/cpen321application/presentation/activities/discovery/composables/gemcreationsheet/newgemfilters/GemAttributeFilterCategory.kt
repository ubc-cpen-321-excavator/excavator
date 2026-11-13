package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.newgemfilters

import androidx.collection.MutableObjectList
import androidx.compose.foundation.layout.ExperimentalGridApi
import androidx.compose.foundation.layout.Grid
import androidx.compose.foundation.layout.GridTrackSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlin.math.ceil

@OptIn(ExperimentalGridApi::class)
@Composable
fun GemAttributeFilterCategory(modifier: Modifier = Modifier, label: String,
                               filters:List<String>, currentFilters: MutableObjectList<String>
) {

    var isShown by remember { mutableStateOf(false) }

    val numColumns = 3

    HorizontalDivider(modifier=Modifier.fillMaxWidth())

    Button(onClick = {isShown = !isShown}, modifier=Modifier.padding(8.dp)) {
        Text(label)
    }

    if (isShown) {
        Grid(
            config = {
                repeat (numColumns) {
                    column(1/numColumns.toFloat())
                }

                repeat(ceil(filters.size/numColumns.toFloat()).toInt()) {
                    row(GridTrackSize.MinContent)
                }

            }
        ) {
            filters.forEach {
                GemAttributeFilterChip(it,currentFilters)
            }
        }
    }

}