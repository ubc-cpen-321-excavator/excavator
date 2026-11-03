package com.example.cpen321application.presentation.activities.dashboard.composables
import android.R.attr.onClick
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.activities.navigateToDiscovery

@Composable
fun GemCard(
    gem: Gem,
    context: Context,
    modifier: Modifier = Modifier
) {
    Card(onClick = { navigateToDiscovery(context,gem) }, modifier = modifier.padding(8.dp)) {
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
