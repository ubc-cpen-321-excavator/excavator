package com.example.cpen321application.presentation.activities.dashboard.composables

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.activities.navigateToDiscovery
import com.google.android.gms.maps.model.LatLng

private val FavoriteGold = Color(0xFFFFC107)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun GemCard(
    gem: Gem,
    context: Context,
    modifier: Modifier = Modifier,
    isFavorite: Boolean = false,
    onLongClick: () -> Unit = {} // only runs when isFavorite is true
) {
    Card(
        modifier = modifier
            .padding(8.dp)
            .clip(MaterialTheme.shapes.medium)
            .combinedClickable(
                onClick = { navigateToDiscovery(context, gem) },
                onLongClick = if (isFavorite) onLongClick else null
            ),
        border = if (isFavorite) BorderStroke(2.dp, FavoriteGold) else null
    ) {
        Box {
            Column(
                modifier = Modifier.padding(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // TODO: replace with AsyncImage when Gem has an image field and Coil is added
                Box(
                    modifier = Modifier
                        .size(96.dp)
                        .background(Color.LightGray)
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = gem.title,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (isFavorite) {
                // Star badge. Drawn as text because the Material icons library isn't available.
                Text(
                    text = "★",
                    color = FavoriteGold,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(4.dp)
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun GemCardPreview() {
    val gem = Gem("Nitobe Memorial Garden", LatLng(49.2663, -123.2599), "places/seed-nitobe-garden")
    Row {
        GemCard(gem = gem, context = LocalContext.current)
        GemCard(gem = gem, context = LocalContext.current, isFavorite = true)
    }
}