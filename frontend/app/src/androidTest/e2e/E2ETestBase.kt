package e2e

import android.Manifest
import android.app.Activity
import android.content.Context
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipe
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import androidx.test.uiautomator.UiDevice
import com.example.cpen321application.R
import com.example.cpen321application.presentation.TestTags
import com.example.cpen321application.presentation.activities.dashboard.DashboardActivity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import org.junit.After
import org.junit.Before
import org.junit.Rule
import kotlin.math.abs

/**
 * Shared setup and UI helpers for the end-to-end UI tests. The tests run the real app against the real
 * backend, as the user who is signed in on the device (the tests never sign in themselves).
 *
 * Before each test the device's location is switched on and the app is granted location permission,
 * so no system dialog covers the app. Each test then opens the app on the Dashboard with [launchDashboard].
 */
abstract class E2ETestBase {

    /**
     * An unconfined dispatcher runs the app's Compose effects straight away on the thread that resumes
     * them (the main thread for frames and map callbacks). With the default queued dispatcher, effects
     * left over at the end of a test run on the test thread, and Google Maps rejects calls made off
     * the main thread.
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    @get:Rule
    val compose = createEmptyComposeRule(effectContext = UnconfinedTestDispatcher())

    private var scenario: ActivityScenario<DashboardActivity>? = null

    protected val device: UiDevice get() = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

    @Before
    fun setUpDevice() {
        signedInToken()
        shell("cmd location set-location-enabled true")
        LOCATION_PERMISSIONS.forEach { shell("pm grant ${appContext.packageName} $it") }
    }

    /**
     * Closes every activity the test opened, not only the Dashboard that [launchDashboard] started:
     * the navigation bar opens Discovery and Favorites as separate activities. This must happen here,
     * before the Compose rule ends. When the rule ends it cancels the compositions that are still alive
     * on the test thread, and the Discovery map then calls Google Maps off the main thread, which
     * Google Maps rejects ("Not on the main thread"). Finished here, each activity is destroyed on the
     * main thread and the map is cleaned up there.
     */
    @After
    fun closeApp() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync { liveActivities().forEach { it.finish() } }
        val deadline = SystemClock.uptimeMillis() + UI_TIMEOUT_MS
        var remaining = activitiesStillAlive()
        while (remaining.isNotEmpty() && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(POLL_MS)
            remaining = activitiesStillAlive()
        }
        check(remaining.isEmpty()) { "These activities were not destroyed after the test: $remaining" }
        runCatching { scenario?.close() }
        scenario = null
    }

    /** The names of the app's activities that are not destroyed yet. */
    private fun activitiesStillAlive(): List<String> {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.waitForIdleSync()
        var names = emptyList<String>()
        instrumentation.runOnMainSync { names = liveActivities().map { it.javaClass.simpleName } }
        return names
    }

    /** The app's activities in any stage before destroyed. Must be called on the main thread. */
    private fun liveActivities(): List<Activity> {
        val monitor = ActivityLifecycleMonitorRegistry.getInstance()
        return LIVE_STAGES.flatMap { monitor.getActivitiesInStage(it) }
    }

    /** The signed-in user's token, as the app stores it (TokenStore). */
    protected fun signedInToken(): String {
        val prefs = appContext.getSharedPreferences(appContext.getString(R.string.prefs_auth), Context.MODE_PRIVATE)
        return checkNotNull(prefs.getString(TOKEN_KEY, null)) {
            "No signed-in user: open the app on the device, sign in, then run the tests."
        }
    }

    /** Opens the app on the Dashboard. */
    protected fun launchDashboard() {
        scenario = ActivityScenario.launch(DashboardActivity::class.java)
        displayed(hasText("Dashboard"))
    }

    /** Taps a destination in the navigation bar ("Dashboard", "Discovery" or "Favorites"). */
    protected fun tapNav(destination: String) {
        displayed(hasContentDescription(destination)).performClick()
    }

    /** Waits until a node matching [matcher] is on screen, and returns it. */
    protected fun displayed(
        matcher: SemanticsMatcher,
        timeoutMs: Long = UI_TIMEOUT_MS,
    ): SemanticsNodeInteraction {
        var found: SemanticsNodeInteraction? = null
        compose.waitUntil("${matcher.description} is displayed", timeoutMs) {
            found = firstDisplayed(matcher)
            found != null
        }
        return checkNotNull(found)
    }

    /** Waits until no node matching [matcher] is on screen. */
    protected fun waitUntilGone(matcher: SemanticsMatcher) {
        compose.waitUntil("${matcher.description} is gone", UI_TIMEOUT_MS) { firstDisplayed(matcher) == null }
    }

    /**
     * Re-checks [condition] every half second, letting the app recompose in between, until it holds.
     * Unlike Compose's own waitUntil, [condition] may itself perform Compose actions such as scrolling.
     */
    protected fun poll(description: String, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + UI_TIMEOUT_MS
        var met = runCatching(condition).getOrDefault(false)
        while (!met && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(POLL_MS)
            compose.waitForIdle()
            met = runCatching(condition).getOrDefault(false)
        }
        check(met) { "Timed out waiting until $description" }
    }

    /** The first text of the first displayed node matching [matcher] (the typed text, for text fields). */
    protected fun textOf(matcher: SemanticsMatcher): String = displayed(matcher).fetchSemanticsNode().firstText()

    /**
     * Taps the gem card titled [title] in the Dashboard's "Latest Gems:" grid (the first card if [title]
     * is null), which opens the Discovery map with that gem's info sheet. Returns the gem's title.
     */
    protected fun openGemFromDashboard(title: String? = null): String {
        val anyCard = hasTestTag(TestTags.GEM_CARD)
        displayed(hasText("Latest Gems:"))
        val gemTitle = title ?: textOf(anyCard)
        val card = anyCard and hasText(gemTitle)
        displayed(hasScrollAction() and hasAnyDescendant(anyCard)).performScrollToNode(card)
        displayed(card).performClick()
        // The sheet shows the title with a capital first letter.
        displayed(hasText(gemTitle, ignoreCase = true) and !anyCard)
        displayed(star())
        return gemTitle
    }

    /**
     * Fully expands the open gem info sheet by dragging its handle to the top of the screen. The sheet
     * opens half expanded; once it is fully expanded its handle offers "collapse" instead of "expand".
     */
    protected fun expandGemInfoSheet() {
        val handleOfHalfOpenSheet = SemanticsMatcher.keyIsDefined(SemanticsActions.Expand)
        val distance = device.displayHeight.toFloat()
        displayed(handleOfHalfOpenSheet).performTouchInput {
            swipe(start = center, end = Offset(center.x, center.y - distance), durationMillis = SWIPE_MS)
        }
        waitUntilGone(handleOfHalfOpenSheet)
        displayed(SemanticsMatcher.keyIsDefined(SemanticsActions.Collapse))
    }

    /** Closes the gem info sheet with the Back button. */
    protected fun closeGemInfoSheet() {
        device.pressBack()
        waitUntilGone(star())
    }

    /** The favorite star on the gem info sheet. */
    protected fun star(): SemanticsMatcher = hasContentDescription(appContext.getString(R.string.favorites_description))

    /**
     * The star's colour, read from its pixels: the star exposes no selected state, only its tint
     * (yellow for a favorite, grey otherwise; see FavoriteButton). Null if neither colour is found.
     */
    protected fun starColor(): StarColor? {
        val pixels = displayed(star()).captureToImage().toPixelMap()
        var yellow = 0
        var grey = 0
        for (x in 0 until pixels.width) {
            for (y in 0 until pixels.height) {
                val pixel = pixels[x, y]
                if (pixel.isCloseTo(STAR_YELLOW)) yellow++ else if (pixel.isCloseTo(STAR_GREY)) grey++
            }
        }
        return when {
            yellow >= MIN_STAR_PIXELS && yellow > grey -> StarColor.YELLOW
            grey >= MIN_STAR_PIXELS -> StarColor.GREY
            else -> null
        }
    }

    /** Waits until the star is [expected], and fails if it does not get there. */
    protected fun assertStarColor(expected: StarColor) {
        var actual: StarColor? = null
        runCatching {
            poll("the star is $expected") {
                actual = starColor()
                actual == expected
            }
        }.onFailure { throw AssertionError("The star should be $expected, but it is $actual", it) }
    }

    private fun firstDisplayed(matcher: SemanticsMatcher): SemanticsNodeInteraction? {
        val nodes = compose.onAllNodes(matcher)
        val count = runCatching { nodes.fetchSemanticsNodes(atLeastOneRootRequired = false).size }.getOrDefault(0)
        return (0 until count).asSequence()
            .map { nodes[it] }
            .firstOrNull { runCatching { it.assertIsDisplayed() }.isSuccess }
    }

    private fun SemanticsNode.firstText(): String =
        config.getOrNull(SemanticsProperties.EditableText)?.text
            ?: config.getOrNull(SemanticsProperties.Text)?.firstOrNull()?.text.orEmpty()

    private fun Color.isCloseTo(other: Color): Boolean =
        abs(red - other.red) < COLOR_TOLERANCE &&
            abs(green - other.green) < COLOR_TOLERANCE &&
            abs(blue - other.blue) < COLOR_TOLERANCE

    private fun shell(command: String): String {
        val output = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(output).bufferedReader().use { it.readText() }
    }

    protected companion object {
        const val DASHBOARD = "Dashboard"
        const val DISCOVERY = "Discovery"
        const val FAVORITES = "Favorites"

        const val UI_TIMEOUT_MS = 15_000L

        private const val TOKEN_KEY = "jwt"
        private const val POLL_MS = 500L
        private const val SWIPE_MS = 300L

        /** The star's two tints in FavoriteButton. */
        private val STAR_YELLOW = Color(red = 200, green = 200, blue = 0)
        private val STAR_GREY = Color.Gray
        private const val COLOR_TOLERANCE = 0.06f
        private const val MIN_STAR_PIXELS = 20

        private val LIVE_STAGES = listOf(
            Stage.PRE_ON_CREATE,
            Stage.CREATED,
            Stage.STARTED,
            Stage.RESUMED,
            Stage.PAUSED,
            Stage.STOPPED,
            Stage.RESTARTED,
        )

        private val LOCATION_PERMISSIONS = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )

        private val appContext: Context get() = InstrumentationRegistry.getInstrumentation().targetContext
    }
}

/** The two colours of the favorite star on the gem info sheet. */
enum class StarColor { YELLOW, GREY }
