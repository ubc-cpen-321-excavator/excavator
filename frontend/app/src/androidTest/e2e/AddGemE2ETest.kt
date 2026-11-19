package e2e

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.cpen321application.presentation.TestTags
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Scenario 1: adding a new gem.
 *
 * The user opens the Discovery map, taps the "Add gem" button (NewGemButton), submits the "Add New Gem"
 * sheet without a filter and taps the first place in the list. The new gem must then be the first
 * card under "Latest Gems:" on the Dashboard.
 *
 * The list of places comes from the device's real location: it must have a location fix with at
 * least one place within 200 m that is not a gem yet. Gems cannot be deleted, so each run leaves
 * one new gem behind.
 */
@RunWith(AndroidJUnit4::class)
class AddGemE2ETest : E2ETestBase() {

    @Test
    fun addNewGem() {
        launchDashboard()
        // The user opens the Discovery map from the navigation bar.
        tapNav(DISCOVERY)
        // The user taps the "Add gem" button, and the "Add New Gem" sheet opens.
        displayed(hasTestTag(TestTags.ADD_GEM_BUTTON)).performClick()
        displayed(hasText("Add New Gem"))
        // The user taps "Submit", and the places nearby that are not gems yet are listed.
        displayed(hasTestTag(TestTags.SUBMIT_BUTTON)).performClick()
        val firstPlace = hasTestTag(TestTags.CANDIDATE_CARD)
        displayed(firstPlace, timeoutMs = CANDIDATES_TIMEOUT_MS)
        val placeName = textOf(firstPlace)
        // The user taps the first place: it is added as a gem and the sheet closes.
        displayed(firstPlace and hasText(placeName)).performClick()
        waitUntilGone(firstPlace)
        // The new gem is the first of the latest gems on the Dashboard.
        tapNav(DASHBOARD)
        displayed(hasText("Latest Gems:"))
        poll("'$placeName' is the first card under 'Latest Gems:'") {
            textOf(hasTestTag(TestTags.GEM_CARD)) == placeName
        }
    }

    private companion object {
        /** Listing places waits for a location fix and for Google Places, so it gets longer. */
        const val CANDIDATES_TIMEOUT_MS = 30_000L
    }
}
