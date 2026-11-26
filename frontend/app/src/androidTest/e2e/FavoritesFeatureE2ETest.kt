package e2e

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.cpen321application.presentation.TestTags
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Feature 6, Favorites, tested front to end in one run: Mark a Gem as favorite, View favorites and
 * Remove a favorite, one after the other on the same gem.
 *
 * After each change made through the UI, the test checks three things:
 * - the screen: the star's colour, and the gem's card on the Favorites screen;
 * - the server: GET /user/favorites, so the change really reached the database;
 * - that it lasts: the sheet is closed and opened again, and the whole app is relaunched, so what is
 *   shown comes back from the backend and not from what the screen remembered.
 *
 * The test uses the newest gem, which is the first card on the Dashboard. It is removed from the
 * user's favorites through the backend before and after the test, so the star starts grey and no
 * favorite is left behind.
 */
@RunWith(AndroidJUnit4::class)
class FavoritesFeatureE2ETest : E2ETestBase() {

    private lateinit var api: BackendClient
    private lateinit var gem: ApiGem

    @Before
    fun setUpGem() {
        api = BackendClient(signedInToken())
        gem = checkNotNull(api.newestGems().firstOrNull()) { "The Dashboard has no gems to open" }
        api.removeFavorite(gem.name)
        check(gem.name !in api.favorites()) { "${gem.name} is still a favorite after the setup removed it" }
    }

    @After
    fun cleanUpFavorite() {
        if (::gem.isInitialized) api.removeFavorite(gem.name)
    }

    @Test
    fun favoritesFeatureFrontToEnd() {
        launchDashboard()

        // 1. Mark a Gem as favorite: the user opens the gem, its star is grey, and they tap it.
        openGem()
        assertStarColor(StarColor.GREY)
        displayed(star()).performClick()
        assertStarColor(StarColor.YELLOW)
        assertServerFavorite(true)

        // 2. Still a favorite when the user closes the sheet and opens the gem again.
        closeGemInfoSheet()
        tapNav(DASHBOARD)
        openGem()
        assertStarColor(StarColor.YELLOW)

        // 3. View favorites: the gem's card, with the ★ badge, is on the Favorites screen.
        closeGemInfoSheet()
        tapNav(FAVORITES)
        displayed(hasText(YOUR_FAVORITES))
        displayed(favoriteCard())

        // 4. Still a favorite after the app is closed and opened again.
        relaunchApp()
        tapNav(FAVORITES)
        displayed(hasText(YOUR_FAVORITES))
        displayed(favoriteCard())

        // 5. Remove a favorite: the user opens the gem, its star is yellow, and they tap it.
        tapNav(DASHBOARD)
        openGem()
        assertStarColor(StarColor.YELLOW)
        displayed(star()).performClick()
        assertStarColor(StarColor.GREY)
        assertServerFavorite(false)

        // 6. Still not a favorite when the user closes the sheet and opens the gem again.
        closeGemInfoSheet()
        tapNav(DASHBOARD)
        openGem()
        assertStarColor(StarColor.GREY)

        // 7. The gem's card is no longer on the Favorites screen.
        closeGemInfoSheet()
        tapNav(FAVORITES)
        displayed(hasText(YOUR_FAVORITES))
        waitUntilGone(favoriteCard())

        // 8. Still gone after the app is closed and opened again.
        relaunchApp()
        tapNav(FAVORITES)
        displayed(hasText(YOUR_FAVORITES))
        waitUntilGone(favoriteCard())
    }

    /** Taps the gem's card on the Dashboard and fully expands its info sheet. */
    private fun openGem() {
        openGemFromDashboard(gem.title)
        expandGemInfoSheet()
    }

    /** Waits until the server lists the gem as a favorite ([expected] true) or not (false). */
    private fun assertServerFavorite(expected: Boolean) {
        val what = if (expected) "lists" else "no longer lists"
        poll("GET /user/favorites $what ${gem.name}") { (gem.name in api.favorites()) == expected }
    }

    /** The gem's card on the Favorites screen. Only favorite cards carry the ★ badge. */
    private fun favoriteCard() = hasTestTag(TestTags.GEM_CARD) and hasText(gem.title) and hasText(FAVORITE_BADGE)

    private companion object {
        const val YOUR_FAVORITES = "Your favorites:"
        const val FAVORITE_BADGE = "★"
    }
}
