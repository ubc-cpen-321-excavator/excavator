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
 * Scenario 3: adding an existing gem as a favorite, and removing it again.
 *
 * Both tests open the gem's info sheet the same way as the comment test: by tapping its card on the
 * Dashboard, then fully expanding the sheet. A favorite shows a yellow star on the sheet and a card on
 * the Favorites screen; a gem that is not a favorite shows a grey star and no card there.
 *
 * The tests use the newest gem, which is the first card on the Dashboard. So that the star starts
 * grey, the gem is removed from the user's favorites through the backend before each test, and again
 * afterwards so no test leaves a favorite behind.
 */
@RunWith(AndroidJUnit4::class)
class FavoriteGemE2ETest : E2ETestBase() {

    private lateinit var api: BackendClient
    private lateinit var gem: ApiGem

    @Before
    fun setUpGem() {
        api = BackendClient(signedInToken())
        gem = checkNotNull(api.newestGems().firstOrNull()) { "The Dashboard has no gems to open" }
        api.removeFavorite(gem.name)
    }

    @After
    fun removeFavorite() {
        if (::gem.isInitialized) api.removeFavorite(gem.name)
    }

    @Test
    fun addGemAsFavorite() {
        launchDashboard()
        addAsFavoriteFromInfoSheet()
    }

    @Test
    fun removeGemFromFavorites() {
        launchDashboard()
        // The gem is made a favorite exactly as in addGemAsFavorite.
        addAsFavoriteFromInfoSheet()
        // The user goes back to the Dashboard and opens the same gem again: its star is yellow.
        tapNav(DASHBOARD)
        openFullyExpandedInfoSheet()
        assertStarColor(StarColor.YELLOW)
        // The user taps the yellow star, and it turns grey.
        displayed(star()).performClick()
        assertStarColor(StarColor.GREY)
        // The gem is no longer on the Favorites screen.
        closeGemInfoSheet()
        tapNav(FAVORITES)
        displayed(hasText(YOUR_FAVORITES))
        waitUntilGone(favoriteCard())
    }

    /** Opens the gem from the Dashboard, taps its grey star, and checks it is now a favorite. */
    private fun addAsFavoriteFromInfoSheet() {
        // The user taps the gem's card on the Dashboard and fully expands its info sheet.
        openFullyExpandedInfoSheet()
        // The gem is not a favorite yet, so its star is grey.
        assertStarColor(StarColor.GREY)
        // The user taps the star, and it turns yellow.
        displayed(star()).performClick()
        assertStarColor(StarColor.YELLOW)
        // The gem is on the Favorites screen.
        closeGemInfoSheet()
        tapNav(FAVORITES)
        displayed(hasText(YOUR_FAVORITES))
        displayed(favoriteCard())
    }

    private fun openFullyExpandedInfoSheet() {
        openGemFromDashboard(gem.title)
        expandGemInfoSheet()
    }

    /** The gem's card on the Favorites screen. Only favorite cards carry the ★ badge. */
    private fun favoriteCard() = hasTestTag(TestTags.GEM_CARD) and hasText(gem.title) and hasText(FAVORITE_BADGE)

    private companion object {
        const val YOUR_FAVORITES = "Your favorites:"
        const val FAVORITE_BADGE = "★"
    }
}
