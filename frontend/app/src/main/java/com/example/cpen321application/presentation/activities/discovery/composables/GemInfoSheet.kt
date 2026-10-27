package com.example.cpen321application.presentation.activities.discovery.composables

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize

import androidx.compose.foundation.layout.padding

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet

import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

import com.example.cpen321application.R

import com.example.cpen321application.data.entities.Gem
import java.util.Locale.getDefault
import com.example.cpen321application.presentation.activities.discovery.composables.comments.CommentCardList

@Composable
fun GemInfoSheet() {

    var showBottomSheet by remember { mutableStateOf(true) }

    GemInfoSheetContent(
        gem = Gem("Sample Gem Title"),
        onShowChange = {showBottomSheet = it},
        showBottomSheet = showBottomSheet
    )

}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GemInfoSheetContent(gem: Gem, onShowChange: (Boolean)->Unit, showBottomSheet: Boolean) {

    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = false,
    )

    if (showBottomSheet) {
        ModalBottomSheet(
            modifier = Modifier.fillMaxHeight(),
            sheetState = sheetState,
            onDismissRequest = { onShowChange(false) }
        ) {
            Column() {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        gem.title.replaceFirstChar { if (it.isLowerCase()) it.titlecase(getDefault()) else it.toString() },
                        modifier = Modifier.padding(16.dp),
                        fontSize = 20.sp
                    )
                    Spacer(modifier=Modifier.weight(1f))
                    FavoriteButton()
                }

                CommentCardList()
            }

        }
    }

}


@Composable
fun FavoriteButton() {

    var checked by remember {mutableStateOf(false)}

    IconButton(
        onClick = {checked = !checked}
    ) {
        Icon(
            painter = painterResource(R.drawable.baseline_star_24),
            contentDescription = stringResource(R.string.favorites_description),
            modifier = Modifier.padding(16.dp).scale(3f),
            tint = if (checked) Color(red=200, green=200, blue=0) else Color.Gray
        )
    }

}


@Preview(showSystemUi = true)
@Composable
fun GemInfoSheetPreview(
    modifier: Modifier = Modifier.fillMaxSize()
) {
    GemInfoSheet()
}