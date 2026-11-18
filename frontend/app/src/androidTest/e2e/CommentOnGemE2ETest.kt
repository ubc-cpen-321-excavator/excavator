package e2e

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.cpen321application.presentation.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Use case 4: Comment on a Gem (Requirements_and_Design.md, section 3.5).
 *
 * Left out, because it would need a forced network failure: 5a (the server cannot be reached).
 * Most tests reuse the user's shared gem. 2a needs a gem with no comments, so it adds a new one.
 * Comments cannot be deleted through the API, so the comments the main scenario posts stay behind;
 * they all start with "E2E test comment".
 */
@RunWith(AndroidJUnit4::class)
class CommentOnGemE2ETest : E2ETestBase() {

    private lateinit var gem: ApiGem

    override fun startArea() = E2EConfig.SHARED_GEM_AREA

    @Before
    fun setUpGem() {
        gem = data.sharedGem()
    }

    @Test
    fun mainSuccessScenario() {
        ui.launchDashboard()
        // 1. The user opens a gem by tapping its marker on the Discovery map.
        ui.openGemFromMarker(gem.title)
        // 2. The gem's sheet: a "Comments" list, oldest first, with each comment's author and text,
        //    and a "New comment..." text field with a "Send Comment" button.
        ui.displayed(hasText("Comments"))
        ui.displayed(hasText("New comment..."), unmerged = true)
        ui.displayed(hasContentDescription("Send Comment"))
        assertOldestCommentFirst()
        // 3-5. The user types a comment and taps "Send Comment"; it is posted and shown last.
        val first = uniqueComment("first")
        postAndCheckComment(first)
        val second = uniqueComment("second")
        postAndCheckComment(second)
        val bodies = ui.textsWithTag(TestTags.COMMENT_BODY)
        assertTrue("'$first' should be above '$second'", bodies.indexOf(first) in 0 until bodies.indexOf(second))
    }

    @Test
    fun scenario2a_noCommentsYet() {
        val newGem = data.freshGem()
        ui.launchDashboard()
        // 1. The user opens a gem by tapping its card on the Dashboard.
        ui.openGemFromDashboardCard(newGem.title)
        // 2. The gem's sheet with a "Comments" list.
        ui.displayed(hasText("Comments"))
        // 2a1. The gem has no comments yet: "No comments yet!" under "Comments".
        ui.displayed(hasText("No comments yet!"))
    }

    @Test
    fun scenario3a_moreThan256Characters() {
        ui.launchDashboard()
        // 1-2. The user opens the gem from its marker.
        ui.openGemFromMarker(gem.title)
        // 3a. The user types more than 256 characters.
        val full = "${E2EConfig.COMMENT_PREFIX} 3a ".padEnd(E2EConfig.MAX_COMMENT_LENGTH, 'x')
        input().performTextInput(full)
        assertEquals("All 256 characters are accepted", full, commentFieldText())
        // 3a1. The text field does not accept characters beyond the 256th.
        input().performTextInput("y")
        assertEquals("The 257th character should not be accepted", full, commentFieldText())
    }

    @Test
    fun scenario3b_newLineOrTab() {
        ui.launchDashboard()
        // 1-2. The user opens the gem from its marker.
        ui.openGemFromMarker(gem.title)
        val typed = "${E2EConfig.COMMENT_PREFIX} 3b"
        input().performTextInput(typed)
        // 3b. The user types a new line, then a tab.
        input().performTextInput("\n")
        // 3b1. The text field ignores it.
        assertEquals("A new line should be ignored", typed, commentFieldText())
        input().performTextInput("\t")
        assertEquals("A tab should be ignored", typed, commentFieldText())
    }

    @Test
    fun scenario4a_emptyOrSpacesOnly() {
        ui.launchDashboard()
        // 1-2. The user opens the gem from its marker.
        ui.openGemFromMarker(gem.title)
        // 4a. The text field is empty: 4a1. "Send Comment" is disabled.
        sendButton().assertIsNotEnabled()
        // 4a. The text field contains only spaces: 4a1. "Send Comment" is disabled.
        input().performTextInput("   ")
        sendButton().assertIsNotEnabled()
    }

    private fun assertOldestCommentFirst() {
        val expected = api.commentBodies(gem).firstOrNull() ?: return
        ui.waitUntil("comments are loaded") { ui.textsWithTag(TestTags.COMMENT_BODY).isNotEmpty() }
        assertEquals("Oldest comment first", expected, ui.textsWithTag(TestTags.COMMENT_BODY).first())
    }

    // Steps 3-5 for one comment.
    private fun postAndCheckComment(text: String) {
        // 3. The user types a comment of up to 256 characters.
        input().performTextInput(text)
        // 4. The user taps "Send Comment".
        sendButton().performClick()
        // 5. The field is cleared and the comment is last in the list, with the user's display name.
        ui.waitUntil("the comment field is cleared") { commentFieldText().isEmpty() }
        ui.waitUntil("'$text' is the last comment") {
            ui.scrollCommentsToEnd()
            ui.textsWithTag(TestTags.COMMENT_BODY).lastOrNull() == text
        }
        assertEquals("Author of the new comment", data.displayName, ui.textsWithTag(TestTags.COMMENT_AUTHOR).last())
    }

    private fun input() = ui.displayed(hasTestTag(TestTags.COMMENT_INPUT))

    private fun sendButton() = ui.displayed(hasTestTag(TestTags.SEND_COMMENT_BUTTON))

    private fun commentFieldText() = ui.textOf(hasTestTag(TestTags.COMMENT_INPUT))

    private fun uniqueComment(label: String) = "${E2EConfig.COMMENT_PREFIX} $label ${System.currentTimeMillis()}"
}
