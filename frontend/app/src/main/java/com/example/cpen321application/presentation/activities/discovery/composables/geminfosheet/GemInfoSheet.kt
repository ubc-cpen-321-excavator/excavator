package com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.comments.CommentCardList
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.comments.NewCommentInput
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.favorite.FavoriteButton
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.gemscore.GemScoreBar
import com.example.cpen321application.presentation.activities.discovery.composables.geminfosheet.localrating.LocalRating
import androidx.compose.ui.platform.LocalLocale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GemInfoSheetContent(gem: Gem, onShowChange: (Boolean)->Unit, showBottomSheet: Boolean, isFavorite:Boolean = false,
                        onFavoritesAdded: (String)->Unit, onFavoritesRemoved: (String)->Unit) {

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
                        gem.title.replaceFirstChar { if (it.isLowerCase()) it.titlecase(LocalLocale.current.platformLocale) else it.toString() },
                        // Title takes only the space left over, so long names wrap
                        // instead of squeezing the favorite button
                        modifier = Modifier.weight(1f).padding(16.dp),
                        fontSize = 20.sp
                    )
                    FavoriteButton (isFavorite) {
                        if (it) onFavoritesRemoved(
                            gem.placesName.removePrefix("places/")
                        ) else onFavoritesAdded(
                            gem.placesName
                        )
                    }
                }

                // TODO: replace dummy values with the gem's real score once the data is available
                GemScoreBar(
                    score = gem.score,
                    maxScore = 100.0,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                )

                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Text(text = "Personal rating", fontSize = 14.sp)
                    LocalRating(
                        initialRating = null,
                        onRatingSelected = { rating -> /* TODO: API call by Filip */ }
                    )
                }

                CommentCardList(modifier = Modifier.weight(1f), gemID = gem.placesName.removePrefix("places/"))
                NewCommentInput(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding(),
                    gemID = gem.placesName.removePrefix("places/")
                )

            }

        }
    }

}

