package com.example.cpen321application.presentation.activities.dashboard.composables

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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.cpen321application.data.entities.Gem

@Composable
fun GemCardGrid(
    gems: List<Gem>,
    onGemClick: (Gem) -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null
) {
    Column(modifier = modifier) {
        if (title != null) {
            Text(text = title, style = MaterialTheme.typography.titleLarge)
        }
        Box(modifier = Modifier.border(1.dp, MaterialTheme.colorScheme.outline)) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.heightIn(max = 400.dp)
            ) {
                items(gems) { gem ->
                    GemCard(gem = gem, onClick = { onGemClick(gem) })
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun GemCardGridPreview() {
    GemCardGrid(gems = mockGems, onGemClick = {}, title = "Recently Added")
}