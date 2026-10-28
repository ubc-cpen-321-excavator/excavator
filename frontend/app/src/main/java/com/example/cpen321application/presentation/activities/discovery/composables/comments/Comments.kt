package com.example.cpen321application.presentation.activities.discovery.composables.comments

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun CommentCardList() {
    LazyVerticalGrid (columns = GridCells.Fixed(1)) {

        item {
            Text(
                text = "Comments",
                fontSize = 20.sp,
                modifier = Modifier.padding(16.dp),
                textDecoration = TextDecoration.Underline
            )

        }

        (1..10).forEach { _ ->
            item {
                CommentCard()
            }
        }
    }
}

@Composable
fun CommentCard() {
    Card(
        modifier = Modifier
            .padding(16.dp)
    ) {

        Text(
            text = "Sample user",
            fontSize = 20.sp,
            modifier = Modifier.padding(8.dp)
        )
        Text(
            text = "bodycontentbodycontentbodycontentbodycontentbodycontentbodycontentbodycontent",
            fontSize = 12.sp,
            modifier = Modifier.padding(8.dp)
        )
    }
}