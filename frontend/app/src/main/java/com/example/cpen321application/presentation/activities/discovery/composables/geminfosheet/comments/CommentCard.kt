package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.comments

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.cpen321application.domain.models.Comment

@Composable
fun CommentCard(
    comment: Comment
) {
    Card(
        modifier = Modifier
            .padding(16.dp)
    ) {

        Text(
            text = comment.authorName ?: "Unknown",
            fontSize = 20.sp,
            modifier = Modifier.padding(8.dp)
        )
        Text(
            text = comment.body,
            fontSize = 12.sp,
            modifier = Modifier.padding(8.dp)
        )
    }
}
