package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.comments

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.presentation.viewmodels.CommentViewModel

@Composable
fun CommentCardList(
    modifier: Modifier = Modifier,
    viewModel: CommentViewModel = hiltViewModel(),
    gemID: String
) {
    val commentState by viewModel.commentState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.getComments(gemID)
    }

    LazyColumn(modifier = modifier)  {

        item {
            Text(
                text = "Comments",
                fontSize = 20.sp,
                modifier = Modifier.padding(16.dp),
                textDecoration = TextDecoration.Underline
            )

        }

        if (commentState.isNotEmpty()) {
            commentState.forEach {
                item {
                    CommentCard(it)
                }
            }
        } else {
            item{Text("No comments yet!")}
        }

    }
}