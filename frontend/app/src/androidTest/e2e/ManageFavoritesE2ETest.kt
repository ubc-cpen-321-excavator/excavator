package e2e

import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.cpen321application.presentation.TestTags
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Use case 5: Manage Favorite Gems (Requirements_and_Design.md, section 3.5).
 *
 * Left out, because they would need a forced network failure: 4b and 8a (the server cannot be reached).
 * Every test uses the user's shared gem. The user's own favorites are backed up before each test and
 * put back afterwards, even if a test crashed (see TestData.backUpFavorites).
 * 4a needs the user to be at the 500-favorite limit; that data comes from the data-population script
 * (TestData.seedFavorites), and the test reports "blocked" until the script exists.
 */
@RunWith(AndroidJUnit4::class)
class ManageFavoritesE2ETest : E2ETestBase() {

    private lateinit var gem: ApiGem

    override fun startArea() = E2EConfig.SHARED_GEM_AREA

    @Before
    fun setUpFavorites() {
        gem = data.sharedGem()
        // Removed before the backup, so the shared gem is never put back as one of the user's favorites.
        api.removeFavorite(gem.name)
        data.backUpFavorites()
    }

    @After
    fun restoreFavorites() {
        data.restoreFavorites()
    }

    @Test
    fun mainSuccessScenario() {
        ui.launchDashboard()
        // 1. The user opens a gem by tapping its marker on the Discovery map.
        ui.openGemFromMarker(gem.title)
        // 2. The gem's sheet with a star button, grey because the gem is not a favorite.
        star().assertIsNotSelected()
        // 3. The user taps the grey star.
        star().performClick()
        // 4. The gem is saved as a favorite and the star turns gold.
        star().assertIsSelected()
        ui.eventually("'${gem.name}' is a favorite on the server") { gem.name in api.favoriteNames() }
        // 5. The user opens the Favorites screen from the navigation bar.
        ui.closeGemSheet()
        ui.tapNav(AppDriver.FAVORITES)
        // 6. "Your favorites:" with a card per favorite, most recent first, each with a ★ badge.
        ui.displayed(hasText("Your favorites:"))
        ui.firstOf(hasTestTag(TestTags.GEM_CARD) and inFavorites()).assert(hasText(gem.title))
        ui.displayed(favoriteCard() and hasText("★"))
        // 7. The user long-presses the gem's card.
        ui.displayed(favoriteCard()).performTouchInput { longClick() }
        // 8. The gem is removed from the user's favorites and its card disappears.
        ui.waitUntilGone(favoriteCard())
        ui.eventually("'${gem.name}' is no longer a favorite on the server") { gem.name !in api.favoriteNames() }
    }

    @Test
    fun scenario3a_tapGoldStar() {
        api.addFavorite(gem.name)
        ui.launchDashboard()
        // 1. The user opens the gem by tapping its marker on the Discovery map.
        ui.openGemFromMarker(gem.title)
        // 2. The star is gold, because the gem is already a favorite.
        star().assertIsSelected()
        // 3a. The user taps the gold star.
        star().performClick()
        // 3a1. The gem is removed from the user's favorites and the star turns grey.
        star().assertIsNotSelected()
        ui.eventually("'${gem.name}' is no longer a favorite on the server") { gem.name !in api.favoriteNames() }
    }

    @Test
    fun scenario4a_atFavoritesLimit() {
        data.removeAllFavorites()
        // 4a. The user already has 500 favorites (made by the data-population script).
        data.seedFavorites(E2EConfig.MAX_FAVORITES)
        ui.launchDashboard()
        // 1. The user opens the gem by tapping its marker on the Discovery map.
        ui.openGemFromMarker(gem.title)
        // 2. The star is grey.
        star().assertIsNotSelected()
        // 3. The user taps the grey star.
        star().performClick()
        // 4a1. The message "You can have at most 500 favorites."
        ui.displayed(hasText("You can have at most 500 favorites."))
        // 4a2. The star stays grey, and the gem is not saved as a favorite.
        star().assertIsNotSelected()
        assertFalse("The gem should not be a favorite on the server", gem.name in api.favoriteNames())
    }

    @Test
    fun scenario6a_noFavorites() {
        data.removeAllFavorites()
        ui.launchDashboard()
        // 5. The user opens the Favorites screen from the navigation bar.
        ui.tapNav(AppDriver.FAVORITES)
        // 6a1. The user has no favorites: "No favorites yet!" under "Your favorites:".
        ui.displayed(hasText("Your favorites:"))
        ui.displayed(hasText("No favorites yet!"))
    }

    private fun star() = ui.displayed(hasTestTag(TestTags.FAVORITE_BUTTON))

    private fun inFavorites() = hasAnyAncestor(hasTestTag(TestTags.FAVORITES_GRID))

    private fun favoriteCard() = hasTestTag(TestTags.GEM_CARD) and hasText(gem.title) and inFavorites()
}
