package e2e

import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.cpen321application.presentation.TestTags
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Scenario 2: adding a comment to an existing gem.
 *
 * The user taps the first gem card on the Dashboard, which opens the gem's info sheet on the Discovery
 * map, fully expands the sheet to reach the "New comment..." field, types a comment and taps
 * "Send Comment". The field must be cleared and the comment must appear in the gem's comment list.
 *
 * Comments cannot be deleted, so each run leaves one comment behind, starting with "UI test comment".
 */
@RunWith(AndroidJUnit4::class)
class CommentOnGemE2ETest : E2ETestBase() {

    @Test
    fun addCommentToExistingGem() {
        launchDashboard()
        // The user taps a gem card on the Dashboard, and the gem's info sheet opens.
        openGemFromDashboard()
        // The user fully expands the sheet, which shows the field for a new comment.
        expandGemInfoSheet()
        val input = hasTestTag(TestTags.COMMENT_INPUT)
        displayed(input)
        // The user types a comment and taps "Send Comment".
        val comment = "UI test comment ${System.currentTimeMillis()}"
        displayed(input).performTextInput(comment)
        poll("the comment field holds the typed comment") { textOf(input) == comment }
        displayed(hasTestTag(TestTags.SEND_COMMENT_BUTTON)).performClick()
        // The field is cleared and the comment is in the gem's comment list.
        poll("the comment field is cleared") { textOf(input).isEmpty() }
        val posted = hasTestTag(TestTags.COMMENT_BODY) and hasText(comment)
        val commentList = hasScrollAction() and hasAnyDescendant(hasTestTag(TestTags.COMMENT_CARD))
        poll("'$comment' is in the comment list") {
            displayed(commentList).performScrollToNode(posted)
            true
        }
        displayed(posted)
    }
}
