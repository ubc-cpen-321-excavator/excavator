package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet

import androidx.collection.MutableObjectList
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.nearbygemcandidates.NearbyGemsOptionsList
import com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.newgemfilters.NewGemFiltersForm


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
                NearbyGemsOptionsList() {
                    showNearbyGems = it
                    onShowChange(it)
                }
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