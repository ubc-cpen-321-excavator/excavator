package e2e

import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.UiObject2
import com.example.cpen321application.presentation.TestTags
import com.example.cpen321application.presentation.activities.dashboard.DashboardActivity
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.math.abs

/**
 * Drives the app as a user would: the Compose testing APIs for the app's own screens, and UI Automator
 * for what is not a Compose node (Google Maps markers) and for the system Back button. The app shows its
 * errors as toasts, which are not Compose nodes either; they are read from the accessibility event
 * Android sends for each toast (see [waitForToast]).
 */
class AppDriver(private val compose: ComposeTestRule) {

    private var scenario: ActivityScenario<DashboardActivity>? = null
    private val toasts = CopyOnWriteArrayList<String>()

    /** Opens the app on its main screen, the Dashboard, as a signed-in user. */
    fun launchDashboard() {
        watchToasts()
        scenario = ActivityScenario.launch(DashboardActivity::class.java)
        displayed(hasText("Dashboard"))
    }

    fun close() {
        scenario?.close()
        scenario = null
        uiAutomation.setOnAccessibilityEventListener(null)
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

    /**
     * Finds a Google Maps marker by its title. Markers are not Compose nodes, so this uses UI Automator.
     * Under the Compose test rule the app's screens only recompose when the test synchronises with
     * Compose, so each poll first waits for Compose to be idle. Otherwise the map would never centre on
     * the user or draw the gems that loaded after it opened, and the marker would never appear.
     */
    fun findMarker(title: String): UiObject2 {
        val selector = By.descContains(title)
        val deadline = SystemClock.uptimeMillis() + E2EConfig.MARKER_TIMEOUT_MS
        var marker = findAfterIdle(selector)
        while (marker == null && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(POLL_MS)
            marker = findAfterIdle(selector)
        }
        return checkNotNull(marker) {
            "Map marker '$title' was not found (UI Automator) within ${E2EConfig.MARKER_TIMEOUT_MS} ms"
        }
    }

    fun openGemFromMarker(title: String) {
        tapNav(DISCOVERY)
        displayed(hasContentDescription(ADD_GEM))
        findMarker(title).click()
        displayed(gemSheetTitle(title))
    }

    /** Opens a gem from its card in the Dashboard's "Latest Gems:" grid, the only grid on the Dashboard. */
    fun openGemFromDashboardCard(title: String) {
        val card = hasTestTag(TestTags.GEM_CARD) and hasText(title)
        displayed(hasTestTag(TestTags.GEM_CARD))
        compose.onNode(hasScrollAction() and hasAnyDescendant(hasTestTag(TestTags.GEM_CARD))).performScrollToNode(card)
        displayed(card).performClick()
        displayed(gemSheetTitle(title))
    }

    /** Closes the gem sheet with the Back button, as a user would before using the navigation bar. */
    fun closeGemSheet() {
        DeviceControl.uiDevice.pressBack()
        waitUntilGone(hasContentDescription(FAVORITE_STAR))
    }

    /** Waits until the app has shown a toast containing [text] (at any time since the app was opened). */
    fun waitForToast(text: String) {
        waitUntil("a toast with '$text' is shown (toasts so far: $toasts)") { toasts.any { text in it } }
    }

    /**
     * The colour of the star in the gem sheet: gold when the gem is a favorite, grey when it is not.
     * The star exposes no selected state, so this looks at the star's pixels, as a user would.
     */
    fun starColor(): StarColor? {
        val pixels = displayed(hasContentDescription(FAVORITE_STAR)).captureToImage().toPixelMap()
        var gold = 0
        var grey = 0
        for (x in 0 until pixels.width) {
            for (y in 0 until pixels.height) {
                val pixel = pixels[x, y]
                if (pixel.isCloseTo(STAR_GOLD)) gold++ else if (pixel.isCloseTo(STAR_GREY)) grey++
            }
        }
        return when {
            gold >= MIN_STAR_PIXELS && gold > grey -> StarColor.GOLD
            grey >= MIN_STAR_PIXELS -> StarColor.GREY
            else -> null
        }
    }

    /** Waits until the star in the gem sheet is [expected], and fails if it does not get there. */
    fun assertStar(expected: StarColor) {
        val deadline = SystemClock.uptimeMillis() + E2EConfig.UI_TIMEOUT_MS
        var actual = runCatching { starColor() }.getOrNull()
        while (actual != expected && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(POLL_MS)
            compose.waitForIdle()
            actual = runCatching { starColor() }.getOrNull()
        }
        check(actual == expected) { "The star should be $expected, but it is $actual" }
    }

    /** Scrolls the comment list to its last comment. */
    fun scrollCommentsToEnd() {
        val list = compose.onNode(commentList())
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

    /** The gem sheet's comment list: the scrollable list holding the "Comments" heading or the comments. */
    private fun commentList(): SemanticsMatcher =
        hasScrollAction() and (hasAnyDescendant(hasText("Comments")) or hasAnyDescendant(hasTestTag(TestTags.COMMENT_CARD)))

    /** Records the text of every toast the app shows, from the accessibility event Android sends for it. */
    private fun watchToasts() {
        toasts.clear()
        uiAutomation.setOnAccessibilityEventListener { event ->
            val isToast = event.eventType == AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED &&
                event.className?.toString() == Toast::class.java.name &&
                event.packageName?.toString() == E2EConfig.APP_PACKAGE
            if (isToast) toasts += event.text.joinToString(" ")
        }
    }

    private fun findAfterIdle(selector: BySelector): UiObject2? {
        compose.waitForIdle()
        return DeviceControl.uiDevice.findObject(selector)
    }

    private fun firstDisplayed(matcher: SemanticsMatcher, unmerged: Boolean): SemanticsNodeInteraction? {
        val nodes = compose.onAllNodes(matcher, useUnmergedTree = unmerged)
        val count = runCatching { nodes.fetchSemanticsNodes(atLeastOneRootRequired = false).size }.getOrDefault(0)
        return (0 until count).asSequence()
            .map { nodes[it] }
            .firstOrNull { node -> runCatching { node.assertIsDisplayed() }.isSuccess }
    }

    /** The gem sheet's title, which sits next to the star (the sheet shows it with a capital first letter). */
    private fun gemSheetTitle(title: String) =
        hasText(title, ignoreCase = true) and hasAnySibling(hasContentDescription(FAVORITE_STAR))

    private fun SemanticsNode.text(): String =
        config.getOrNull(SemanticsProperties.EditableText)?.text
            ?: config.getOrNull(SemanticsProperties.Text)?.joinToString(" ") { it.text }.orEmpty()

    private fun Color.isCloseTo(other: Color): Boolean =
        abs(red - other.red) < COLOR_TOLERANCE &&
            abs(green - other.green) < COLOR_TOLERANCE &&
            abs(blue - other.blue) < COLOR_TOLERANCE

    companion object {
        const val DASHBOARD = "Dashboard"
        const val DISCOVERY = "Discovery"
        const val FAVORITES = "Favorites"
        const val ADD_GEM = "Add gem"

        /** The content description of the star in the gem sheet (R.string.favorites_description). */
        const val FAVORITE_STAR = "The favorites button"

        private const val POLL_MS = 500L
        private const val MAX_SWIPES = 20

        /** The star's two tints in FavoriteButton. */
        private val STAR_GOLD = Color(red = 200, green = 200, blue = 0)
        private val STAR_GREY = Color.Gray
        private const val COLOR_TOLERANCE = 0.06f
        private const val MIN_STAR_PIXELS = 20

        private val uiAutomation get() = InstrumentationRegistry.getInstrumentation().uiAutomation
    }
}

/** The two colours of the star in the gem sheet. */
enum class StarColor { GOLD, GREY }
