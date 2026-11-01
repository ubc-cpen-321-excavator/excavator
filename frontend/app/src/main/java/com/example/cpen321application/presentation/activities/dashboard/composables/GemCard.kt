package com.example.cpen321application.presentation.activities.dashboard.composables
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
//import coil.compose.AsyncImage
import com.example.cpen321application.data.entities.Gem

@Composable
fun GemCard(
    gem: Gem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(onClick = onClick, modifier = modifier.padding(8.dp)) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // TODO: replace with AsyncImage when Gem has an image field and Coil is added, tell claude AGP version and ask it to set it up
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
    }
}

@Preview(showBackground = true)
@Composable
fun GemCardPreview() {
    GemCard(gem = mockGems.first(), onClick = {})
}