package e2e

import android.os.SystemClock
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.core.app.ActivityScenario
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import com.example.cpen321application.presentation.TestTags
import com.example.cpen321application.presentation.activities.dashboard.DashboardActivity
import org.junit.Assert.assertEquals
import java.util.regex.Pattern

/**
 * Drives the app as a user would: the Compose testing APIs for the app's own screens, and UI Automator
 * for what is not a Compose node (Google Maps markers and system dialogs).
 */
class AppDriver(private val compose: ComposeTestRule) {

    private var scenario: ActivityScenario<DashboardActivity>? = null

    /** Opens the app on its main screen, the Dashboard, as a signed-in user. */
    fun launchDashboard() {
        scenario = ActivityScenario.launch(DashboardActivity::class.java)
        displayed(hasText("Dashboard"))
    }

    fun close() {
        scenario?.close()
        scenario = null
    }

    /** Waits until a node matching [matcher] is on screen, and returns it. */
    fun displayed(matcher: SemanticsMatcher, unmerged: Boolean = false): SemanticsNodeInteraction {
        var found: SemanticsNodeInteraction? = null
        compose.waitUntil("${matcher.description} is displayed", E2EConfig.UI_TIMEOUT_MS) {
            found = firstDisplayed(matcher, unmerged)
            found != null
        }
        return checkNotNull(found)
    }

    /** Waits until no node matching [matcher] is on screen. */
    fun waitUntilGone(matcher: SemanticsMatcher) {
        compose.waitUntil("${matcher.description} is gone", E2EConfig.UI_TIMEOUT_MS) {
            firstDisplayed(matcher, unmerged = false) == null
        }
    }

    /** Waits until [condition] holds, re-checking it on every frame (use for UI state). */
    fun waitUntil(description: String, condition: () -> Boolean) {
        compose.waitUntil(description, E2EConfig.UI_TIMEOUT_MS) { runCatching(condition).getOrDefault(false) }
    }

    /** Waits until [condition] holds, re-checking it every half second (use for API calls). */
    fun eventually(description: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + E2EConfig.UI_TIMEOUT_MS
        var met = condition()
        while (!met && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(POLL_MS)
            met = condition()
        }
        check(met) { "Timed out waiting until $description" }
    }

    /** The text of the first displayed node matching [matcher] (the typed text, for text fields). */
    fun textOf(matcher: SemanticsMatcher): String = displayed(matcher).fetchSemanticsNode().text()

    /** The texts of every composed node with [tag], in screen order. */
    fun textsWithTag(tag: String): List<String> =
        compose.onAllNodes(hasTestTag(tag), useUnmergedTree = true)
            .fetchSemanticsNodes(atLeastOneRootRequired = false)
            .map { it.text() }

    /** The text of the first composed node matching [matcher] right now, without waiting; null if none. */
    fun firstTextOrNull(matcher: SemanticsMatcher): String? =
        compose.onAllNodes(matcher).fetchSemanticsNodes(atLeastOneRootRequired = false).firstOrNull()?.text()

    /** The first node matching [matcher], once at least one is displayed. */
    fun firstOf(matcher: SemanticsMatcher): SemanticsNodeInteraction {
        displayed(matcher)
        return compose.onAllNodes(matcher)[0]
    }

    fun tapNav(destination: String) {
        displayed(hasContentDescription(destination)).performClick()
    }

    /** Finds a Google Maps marker by its title. Markers are not Compose nodes, so this uses UI Automator. */
    fun findMarker(title: String): UiObject2 {
        val marker = DeviceControl.uiDevice.wait(Until.findObject(By.descContains(title)), E2EConfig.MARKER_TIMEOUT_MS)
        return checkNotNull(marker) { "Map marker '$title' was not found (UI Automator)" }
    }

    fun openGemFromMarker(title: String) {
        tapNav(DISCOVERY)
        displayed(hasContentDescription(ADD_GEM))
        findMarker(title).click()
        displayed(gemSheetTitle(title))
    }

    fun openGemFromDashboardCard(title: String) {
        val inLatestGems = hasAnyAncestor(hasTestTag(TestTags.LATEST_GEMS_GRID))
        val card = hasTestTag(TestTags.GEM_CARD) and hasText(title) and inLatestGems
        displayed(hasTestTag(TestTags.GEM_CARD) and inLatestGems)
        compose.onNode(hasScrollAction() and inLatestGems).performScrollToNode(card)
        displayed(card).performClick()
        displayed(gemSheetTitle(title))
    }

    /** Closes the gem sheet with the Back button, as a user would before using the navigation bar. */
    fun closeGemSheet() {
        DeviceControl.uiDevice.pressBack()
        waitUntilGone(hasTestTag(TestTags.GEM_INFO_SHEET))
    }

    /** Scrolls the comment list to its last comment. */
    fun scrollCommentsToEnd() {
        val list = compose.onNodeWithTag(TestTags.COMMENT_LIST)
        var previous: String? = null
        var current = textsWithTag(TestTags.COMMENT_BODY).lastOrNull()
        var swipes = 0
        while (current != previous && swipes < MAX_SWIPES) {
            list.performTouchInput { swipeUp() }
            compose.waitForIdle()
            previous = current
            current = textsWithTag(TestTags.COMMENT_BODY).lastOrNull()
            swipes++
        }
    }

    /** Fails [step] if another app's window (for example a system dialog) is covering the app. */
    fun assertAppInForeground(step: String) {
        SystemClock.sleep(E2EConfig.SETTLE_MS)
        val foreground = DeviceControl.uiDevice.currentPackageName
        assertEquals("$step: a window from '$foreground' is covering the app", E2EConfig.APP_PACKAGE, foreground)
    }

    fun denyLocationPermission() = clickSystemButton("the system location-permission prompt", DENY_BUTTONS)

    fun allowLocationPermission() = clickSystemButton("the system location-permission prompt", ALLOW_BUTTONS)

    fun acceptTurnOnLocation() = clickSystemButton("the system 'turn on location' prompt", TURN_ON_BUTTONS)

    private fun clickSystemButton(what: String, selectors: List<BySelector>) {
        val deadline = SystemClock.uptimeMillis() + E2EConfig.SYSTEM_DIALOG_TIMEOUT_MS
        var button = findAny(selectors)
        while (button == null && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(POLL_MS)
            button = findAny(selectors)
        }
        checkNotNull(button) { "No expected button was found on $what (UI Automator)" }.click()
    }

    private fun findAny(selectors: List<BySelector>): UiObject2? =
        selectors.firstNotNullOfOrNull { DeviceControl.uiDevice.findObject(it) }

    private fun firstDisplayed(matcher: SemanticsMatcher, unmerged: Boolean): SemanticsNodeInteraction? {
        val nodes = compose.onAllNodes(matcher, useUnmergedTree = unmerged)
        val count = runCatching { nodes.fetchSemanticsNodes(atLeastOneRootRequired = false).size }.getOrDefault(0)
        return (0 until count).asSequence()
            .map { nodes[it] }
            .firstOrNull { node -> runCatching { node.assertIsDisplayed() }.isSuccess }
    }

    private fun gemSheetTitle(title: String) = hasTestTag(TestTags.GEM_TITLE) and hasText(title, ignoreCase = true)

    private fun SemanticsNode.text(): String =
        config.getOrNull(SemanticsProperties.EditableText)?.text
            ?: config.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text }.orEmpty()

    companion object {
        const val DASHBOARD = "Dashboard"
        const val DISCOVERY = "Discovery"
        const val FAVORITES = "Favorites"
        const val ADD_GEM = "Add gem"

        private const val POLL_MS = 500L
        private const val MAX_SWIPES = 20
        private const val PERMISSION_IDS = "com.android.permissioncontroller:id/"

        private val DENY_BUTTONS = listOf(
            By.res(PERMISSION_IDS + "permission_deny_button"),
            By.res(PERMISSION_IDS + "permission_deny_and_dont_ask_again_button"),
            By.text(Pattern.compile("(?i)don.t allow|deny")),
        )
        private val ALLOW_BUTTONS = listOf(
            By.res(PERMISSION_IDS + "permission_allow_foreground_only_button"),
            By.res(PERMISSION_IDS + "permission_allow_button"),
            By.text(Pattern.compile("(?i)while using the app|allow")),
        )
        private val TURN_ON_BUTTONS = listOf(By.text(Pattern.compile("(?i)turn on|ok")))
    }
}
