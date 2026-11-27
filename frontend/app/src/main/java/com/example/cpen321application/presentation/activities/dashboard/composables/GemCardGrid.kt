package com.example.cpen321application.presentation.activities.dashboard.composables

import android.content.Context
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.viewmodels.UiState
import com.google.android.gms.maps.model.LatLng

@Composable
fun GemCardGrid(
    gemState: UiState<List<Gem>>,
    context: Context,
    modifier: Modifier = Modifier,
    title: String? = null,
    isFavorite: Boolean = false,
    onGemLongClick: (Gem) -> Unit = {}
) {
    Column(modifier = modifier) {
        if (title != null) {
            Text(text = title, style = MaterialTheme.typography.titleLarge)
        }

        if (gemState.errorMessage != null) {
            Text("Error fetching gems\n${gemState.errorMessage}")
        } else {
            Box(modifier = Modifier.border(1.dp, MaterialTheme.colorScheme.outline)) {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.heightIn(max = 400.dp)
                ) {
                    items(gemState.data) { gem ->
                        GemCard(
                            gem = gem,
                            context = context,
                            isFavorite = isFavorite,
                            onLongClick = { onGemLongClick(gem) }
                        )
                    }
                }
            }
        }
    }
}

private val previewGems = listOf(
    "Wreck Beach Sunset",
    "Rose Garden",
    "Nitobe Memorial Garden",
    "Museum of Anthropology",
    "Pacific Spirit Park Trail"
).map { title ->
    Gem(title = title, coords = LatLng(0.0, 0.0), placesName = title, score = 4.0, localRating = 0.0)
}

@Preview(showBackground = true)
@Composable
fun GemCardGridPreview() {
    GemCardGrid(
        gemState = UiState(data = previewGems),
        context = LocalContext.current,
        title = "Latest Gems:"
    )
}

@Preview(showBackground = true)
@Composable
fun GemCardGridFavoritesPreview() {
    GemCardGrid(
        gemState = UiState(data = previewGems.take(2)),
        context = LocalContext.current,
        isFavorite = true
    )
}

@Preview(showBackground = true)
@Composable
fun GemCardGridErrorPreview() {
    GemCardGrid(
        gemState = UiState(errorMessage = "Network unavailable", data = previewGems),
        context = LocalContext.current,
        title = "Latest Gems:"
    )
}