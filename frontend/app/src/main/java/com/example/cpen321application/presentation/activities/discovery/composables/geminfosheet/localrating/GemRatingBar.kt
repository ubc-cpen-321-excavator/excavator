package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.localrating

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin

private const val STAR_COUNT = 5

/** Rounds to the nearest 0.5 (ties round up) and keeps the result within 0..5. */
fun roundToHalfStar(rating: Float?): Float =
    (floor((rating ?: 0f) * 2f + 0.5f) / 2f).coerceIn(0f, STAR_COUNT.toFloat())

@Composable
fun LocalRating(
    modifier: Modifier = Modifier,
    initialRating: Float? = null,
    starSize: Dp = 40.dp,
    onRatingSelected: (Float) -> Unit = {} // called when the finger is released
) {
    var rating by remember { mutableFloatStateOf(roundToHalfStar(initialRating)) }
    LaunchedEffect(initialRating) { rating = roundToHalfStar(initialRating) }

    val currentOnRatingSelected by rememberUpdatedState(onRatingSelected)
    val filledColor = Color(0xFFFFC107)
    val outlineColor = MaterialTheme.colorScheme.outline

    Canvas(
        modifier = modifier
            .size(width = starSize * STAR_COUNT, height = starSize)
            .semantics { contentDescription = "Rating: $rating out of 5 stars" }
            .pointerInput(Unit) {
                awaitEachGesture {
                    val starWidthPx = size.width / STAR_COUNT.toFloat()

                    fun ratingAt(x: Float): Float =
                        (ceil(x / starWidthPx * 2f) / 2f).coerceIn(0f, STAR_COUNT.toFloat())

                    val down = awaitFirstDown()
                    rating = ratingAt(down.position.x)
                    down.consume()

                    do {
                        val event = awaitPointerEvent()
                        event.changes.firstOrNull()?.let { change ->
                            if (change.pressed) {
                                rating = ratingAt(change.position.x)
                                change.consume()
                            }
                        }
                    } while (event.changes.any { it.pressed })

                    // Finger released
                    currentOnRatingSelected(rating)
                }
            }
    ) {
        val starPx = size.width / STAR_COUNT
        for (i in 0 until STAR_COUNT) {
            val left = i * starPx
            val path = starPath(cx = left + starPx / 2f, cy = size.height / 2f, outer = starPx * 0.45f)
            val fillFraction = (rating - i).coerceIn(0f, 1f)

            if (fillFraction > 0f) {
                clipRect(left = left, top = 0f, right = left + starPx * fillFraction, bottom = size.height) {
                    drawPath(path, filledColor)
                }
            }
            drawPath(path, outlineColor, style = Stroke(width = 3f))
        }
    }
}

private fun starPath(cx: Float, cy: Float, outer: Float): Path {
    val inner = outer * 0.5f
    return Path().apply {
        for (i in 0 until 10) {
            val r = if (i % 2 == 0) outer else inner
            val angle = PI / 5 * i - PI / 2
            val point = Offset(cx + (r * cos(angle)).toFloat(), cy + (r * sin(angle)).toFloat())
            if (i == 0) moveTo(point.x, point.y) else lineTo(point.x, point.y)
        }
        close()
    }
}

@Preview(showBackground = true)
@Composable
fun LocalRatingPreview() {
    LocalRating(initialRating = 3.3f) // shows 3.5 stars
}