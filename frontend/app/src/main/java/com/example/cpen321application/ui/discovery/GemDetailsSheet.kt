package com.example.cpen321application.ui.discovery

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.cpen321application.model.Gem

/**
 * Bottom sheet with a gem's details, opened when its pin is tapped.
 *
 * We use our own Compose sheet instead of the Maps SDK's built-in info window because the info window is drawn as a
 * static image, so buttons inside it can't be tapped. The Discovery Screen MVP (#11) can add actions here.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun GemDetailsSheet(
    gem: Gem,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
        ) {
            Text(text = gem.name, style = MaterialTheme.typography.headlineSmall)
            Spacer(modifier = Modifier.height(height = 8.dp))
            Text(text = gem.description, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
