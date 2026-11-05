package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet

import androidx.collection.MutableObjectList
import androidx.compose.foundation.layout.ExperimentalGridApi
import androidx.compose.foundation.layout.Grid
import androidx.compose.foundation.layout.GridTrackSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kotlin.math.ceil


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GemCreationSheet(onShowChange: (Boolean)-> Unit, showBottomSheet: Boolean) {

    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true
    )

    val filterList = MutableObjectList<String>()

    var showNearbyGems by remember { mutableStateOf(false) }

    if (showBottomSheet) {
        ModalBottomSheet(
            modifier = Modifier.fillMaxHeight(),
            sheetState = sheetState,
            onDismissRequest = { onShowChange(false) }
        ) {
            if (!showNearbyGems) {
                NewGemFiltersForm(filterList) { showNearbyGems = it }
            } else {
                NearbyGemsOptionsList(){
                    showNearbyGems = it
                    onShowChange(it)
                }
            }

        }
    }
}

@Composable
fun GemAttributeFilterChip(label: String, currentFilters: MutableObjectList<String>) {

    var checked by remember { mutableStateOf(label in currentFilters) }

    FilterChip(selected = checked, onClick = {

        checked = !checked
        if (checked) currentFilters.add(label) else currentFilters.remove(label)},
        label={Text(label)},modifier=Modifier.padding(8.dp)
    )

}


@Composable
fun GemFilterChoices(showFilters: Boolean, currentFilters: MutableObjectList<String>){

    if (showFilters) {
        LazyColumn (modifier = Modifier.fillMaxWidth()) {

            item {
                GemAttributeFilterCategory(
                    modifier=Modifier.fillMaxWidth(),
                    label="Recreation",
                    filters = listOf(
                        "Gym","Sports", "Garden",
                    ),
                    currentFilters
                )
            }

            item {
                GemAttributeFilterCategory(
                    modifier=Modifier.fillMaxWidth(),
                    label="Entertainment",
                    filters = listOf(
                        "Night club", "Comedy club", "Internet cafe",
                        "Karaoke", "Live music venue", "Skate park",
                        "Video arcade"
                    ),
                    currentFilters
                )
            }

            item{
                GemAttributeFilterCategory(
                    modifier=Modifier.fillMaxWidth(),
                    label="Culture",
                    filters = listOf(
                        "Museum", "Art gallery"
                    ),
                    currentFilters
                )
            }

            item {
                GemAttributeFilterCategory(
                    modifier=Modifier.fillMaxWidth(),
                    label="Food",
                    filters = listOf(
                        "Restaurant", "Bar"
                    ),
                    currentFilters
                )
            }

        }
    }

}


@OptIn(ExperimentalGridApi::class)
@Composable
fun GemAttributeFilterCategory(modifier: Modifier = Modifier, label: String,
                               filters:List<String>, currentFilters: MutableObjectList<String>) {

    var isShown by remember { mutableStateOf(false) }

    val NUM_COLUMNS = 3

    HorizontalDivider(modifier=Modifier.fillMaxWidth())

    Button(onClick = {isShown = !isShown}, modifier=Modifier.padding(8.dp)) {
        Text(label)
    }

    if (isShown) {
        Grid(
            config = {
                repeat (NUM_COLUMNS) {
                    column(1/NUM_COLUMNS.toFloat())
                }

                repeat(ceil(filters.size/NUM_COLUMNS.toFloat()).toInt()) {
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

@Preview
@Composable
fun GemCreationSheetPreview(){

    var showSheet by remember { mutableStateOf(true) }

    GemCreationSheet({showSheet = it}, showSheet)
}