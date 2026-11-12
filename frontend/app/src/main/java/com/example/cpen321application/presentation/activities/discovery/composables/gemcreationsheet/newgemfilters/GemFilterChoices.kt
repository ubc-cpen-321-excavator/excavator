package com.example.cpen321application.presentation.activities.discovery.composables.gemcreationsheet.newgemfilters

import androidx.collection.MutableObjectList
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

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