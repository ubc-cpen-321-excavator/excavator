package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.gemscore

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Fraction of the bar to fill: 0 when maxScore <= 0, otherwise score / maxScore kept within 0..1. */
fun gemScoreFraction(score: Int, maxScore: Int): Float =
    if (maxScore <= 0) 0f else (score.toFloat() / maxScore.toFloat()).coerceIn(0f, 1f)

@Composable
fun GemScoreBar(
    score: Int,
    maxScore: Int,
    modifier: Modifier = Modifier
) {
    val fraction = gemScoreFraction(score, maxScore)

    Column(
        modifier = modifier.semantics { contentDescription = "Gem score: $score out of $maxScore" }
    ) {
        Text(text = "Gem Score: $score / $maxScore", fontSize = 14.sp)
        LinearProgressIndicator(
            progress = { fraction }, // determinate, not animated
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp)
                .height(8.dp),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun GemScoreBarPreview() {
    GemScoreBar(score = 7, maxScore = 10)
}
