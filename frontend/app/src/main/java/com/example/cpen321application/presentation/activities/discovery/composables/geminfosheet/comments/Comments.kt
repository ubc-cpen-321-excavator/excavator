package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.comments

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.byValue
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen321application.R
import com.example.cpen321application.domain.models.Comment
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

@Composable
fun NewCommentInput(
    modifier: Modifier = Modifier,
    viewModel: CommentViewModel = hiltViewModel(),
    gemID: String
) {

    val addedCommentState by viewModel.addedCommentState.collectAsState()

    val maxChars = 256
    val maxLines = 10

    val commentState = rememberTextFieldState()

    Row(
        modifier = modifier.height(intrinsicSize = IntrinsicSize.Max).border(width=Dp.Hairline,color=Color.White)
    ) {

        TextField(
            state = commentState,
            inputTransformation = InputTransformation.maxLength(maxChars).byValue { current, proposed: CharSequence ->
                if ("""[\n\t]""".toRegex() in proposed) current else proposed
            },
            lineLimits = TextFieldLineLimits.MultiLine(minHeightInLines = 1, maxHeightInLines = maxLines),
            modifier = Modifier.weight(1f).clip(shape= RectangleShape),
            placeholder = {Text("New comment...")}
        )

        IconButton(onClick = {
            viewModel.addComment(gemID, commentState.text.toString())
            commentState.clearText()

                             },
            modifier = Modifier.align(Alignment.CenterVertically)) {
            Icon(
                painter = painterResource(R.drawable.arrow_circle_up_24),
                contentDescription = "Send Comment",
                modifier = Modifier.scale(2f)
            )
        }
    }

}
