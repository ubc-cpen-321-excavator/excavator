package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.comments

import android.R.attr.label
import android.R.attr.onClick
import android.R.attr.text
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.delete
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.then
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.example.cpen321application.R

@Composable
fun CommentCardList(modifier: Modifier = Modifier) {
    LazyColumn(modifier = modifier)  {

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

@Composable
fun NewCommentInput(modifier: Modifier = Modifier) {

    val maxChars = 256
    val maxLines = 10

    val commentState = rememberTextFieldState()

    Row(
        modifier = modifier.height(intrinsicSize = IntrinsicSize.Max).border(width=Dp.Hairline,color=Color.White)
    ) {

        TextField(
            state = commentState,
            inputTransformation = InputTransformation.maxLength(maxChars).then {

            },
            lineLimits = TextFieldLineLimits.MultiLine(minHeightInLines = 1, maxHeightInLines = maxLines),
            modifier = Modifier.weight(1f).clip(shape= RectangleShape),
        )

        IconButton(onClick = {}, modifier = Modifier.align(Alignment.CenterVertically)) {
            Icon(
                painter = painterResource(R.drawable.arrow_circle_up_24),
                contentDescription = "hi",
                modifier = Modifier.scale(2f)
            )
        }
    }

}

@Preview(showSystemUi = true)
@Composable
fun NewCommentInputPreview() {
    NewCommentInput()
}