package e2e

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsNotEnabled
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
 *
 * The other tests check failure scenarios and the field's limit, and post nothing: Send is disabled
 * on an empty field (UC5 3a), a gem without comments shows the empty-list message (UC5 2b), and
 * typing stops at the field's 256-character limit.
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

    /** UC5 3a: with nothing typed, "Send Comment" must be disabled. */
    @Test
    fun sendDisabledWhenFieldEmpty() {
        launchDashboard()
        openGemFromDashboard()
        expandGemInfoSheet()
        assertCommentFieldHolds("", "UC5 3a")
        val send = displayed(hasTestTag(TestTags.SEND_COMMENT_BUTTON))
        runCatching { send.assertIsNotEnabled() }.onFailure {
            throw AssertionError(
                "UC5 3a: Send Comment should be disabled when the comment field is empty, but it is enabled.",
                it,
            )
        }
    }

    /**
     * UC5 2b: a gem without comments shows the app's empty-list message. The spec words it
     * "No comments yet, be the first"; this test checks the text the app shows (see Testing.md).
     * It needs one of the Dashboard's newest gems to have no comments, and never creates a gem.
     */
    @Test
    fun showsNoCommentsMessage() {
        val api = BackendClient(signedInToken())
        val gems = api.newestGems()
        val gem = checkNotNull(gems.firstOrNull { api.commentCount(it.name) == 0 }) {
            "Setup: none of the ${gems.size} newest gems on the Dashboard has zero comments, " +
                "and this test needs one. It never creates a gem."
        }
        launchDashboard()
        openGemFromDashboard(gem.title)
        expandGemInfoSheet()
        runCatching { displayed(hasText(NO_COMMENTS_MESSAGE)) }.onFailure {
            throw AssertionError(
                "UC5 2b: expected \"$NO_COMMENTS_MESSAGE\" for '${gem.title}', which has no comments, " +
                    "but the comment list shows: ${commentListOnScreen()}",
                it,
            )
        }
    }

    /**
     * The comment field's limit in the app: 256 characters. Typing stops there, so one more
     * character after the limit is ignored. Nothing is sent.
     */
    @Test
    fun commentStopsAt256Characters() {
        launchDashboard()
        openGemFromDashboard()
        expandGemInfoSheet()
        val atLimit = "E2E test comment ".padEnd(MAX_COMMENT_CHARS, 'a')
        displayed(hasTestTag(TestTags.COMMENT_INPUT)).performTextInput(atLimit)
        assertCommentFieldHolds(atLimit, "Typing $MAX_COMMENT_CHARS characters")
        displayed(hasTestTag(TestTags.COMMENT_INPUT)).performTextInput("b")
        assertCommentFieldHolds(atLimit, "Typing one more character after $MAX_COMMENT_CHARS")
    }

    /** Waits until the comment field holds [expected]; on failure, says what it holds instead. */
    private fun assertCommentFieldHolds(expected: String, step: String) {
        var actual = ""
        runCatching {
            poll("the comment field holds ${expected.length} characters") {
                actual = textOf(hasTestTag(TestTags.COMMENT_INPUT))
                actual == expected
            }
        }.onFailure {
            throw AssertionError(
                "$step: the comment field should hold ${expected.length} characters, " +
                    "but it holds ${actual.length}: \"${actual.take(PREVIEW_CHARS)}\"",
                it,
            )
        }
    }

    /** What the comment list shows instead of the empty message: an error, or how many comments. */
    private fun commentListOnScreen(): String {
        val error = compose.onAllNodes(hasText(COMMENTS_ERROR_PREFIX, substring = true))
            .fetchSemanticsNodes(atLeastOneRootRequired = false)
            .firstOrNull()?.config?.getOrNull(SemanticsProperties.Text)?.joinToString()
        val comments = compose.onAllNodes(hasTestTag(TestTags.COMMENT_BODY))
            .fetchSemanticsNodes(atLeastOneRootRequired = false).size
        return error ?: "$comments comment(s) and no empty-list message"
    }

    private companion object {
        /** The empty-list text CommentCardList shows. */
        const val NO_COMMENTS_MESSAGE = "No comments yet!"
        const val COMMENTS_ERROR_PREFIX = "Error fetching comments"

        /** The maxLength of NewCommentInput's text field. */
        const val MAX_COMMENT_CHARS = 256
        const val PREVIEW_CHARS = 40
    }
}
