package e2e

import android.os.SystemClock
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.cpen321application.presentation.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Use case 2: Add a Gem (Requirements_and_Design.md, section 3.5).
 *
 * Left out, because they would need a mocked backend or a forced network failure:
 * 7b (Google Places unavailable) and 9c (the server cannot be reached).
 * Also left out: 2a (location permission denied) and 2b (location turned off). Location and its
 * permission are handled app-wide, not by this use case; they are to be covered in M3.
 * Gems cannot be deleted through the API, so the main scenario and 9a each leave one gem behind.
 *
 * The app closes the sheet as soon as a place is tapped, and shows a failed add as a toast
 * ("Error: " followed by the server's message), so 9a and 9b check for that toast.
 */
@RunWith(AndroidJUnit4::class)
class AddGemE2ETest : E2ETestBase() {

    private lateinit var area: GeoPoint

    override fun startArea(): GeoPoint {
        area = data.areaWithCandidates(E2EConfig.RESTAURANT_TYPE)
        return area
    }

    @Test
    fun mainSuccessScenario() {
        val knownGem = data.ownGemNear(area)
        ui.launchDashboard()
        // 1. The user opens the Discovery screen from the navigation bar.
        ui.tapNav(AppDriver.DISCOVERY)
        // 2. A map centred on the user, with markers for the gems around them, and an "Add gem" button.
        ui.displayed(hasContentDescription(AppDriver.ADD_GEM))
        ui.findMarker(knownGem.title)
        // 3. The user taps "Add gem".
        ui.displayed(hasContentDescription(AppDriver.ADD_GEM)).performClick()
        // 4. The "Add New Gem" sheet, with a "Filters" button and a "Submit" button.
        ui.displayed(hasText("Add New Gem"))
        ui.displayed(hasTestTag(TestTags.FILTERS_BUTTON) and hasText("Filters", substring = true))
        ui.displayed(hasTestTag(TestTags.SUBMIT_BUTTON) and hasText("Submit"))
        // 5. The user taps "Filters" and selects a type of place.
        ui.displayed(hasTestTag(TestTags.FILTERS_BUTTON)).performClick()
        ui.displayed(hasTestTag(TestTags.filterCategory("Food"))).performClick()
        ui.displayed(hasTestTag(TestTags.filterChip("Restaurant"))).performClick().assertIsSelected()
        // 6. The user taps "Submit".
        ui.displayed(hasTestTag(TestTags.SUBMIT_BUTTON)).performClick()
        // 7. Places within 200 m that are not gems yet, nearest first, limited to the selected type.
        val expected = checkNotNull(data.firstCandidate(area, E2EConfig.RESTAURANT_TYPE)) { "No restaurant left" }
        assertEquals("First place in the list", expected.displayName, firstCandidateName())
        // 8. The user taps a place in the list.
        ui.displayed(hasTestTag(TestTags.CANDIDATE_CARD) and hasText(expected.displayName)).performClick()
        // 9. The gem is added, the sheet closes, and the gem is on the map and first on the Dashboard.
        ui.waitUntilGone(hasTestTag(TestTags.CANDIDATE_CARD))
        ui.findMarker(expected.displayName)
        ui.tapNav(AppDriver.DASHBOARD)
        // The Dashboard's only grid is "Latest Gems:", so its first gem card is the latest gem.
        val latestGem = hasTestTag(TestTags.GEM_CARD)
        ui.displayed(hasText("Latest Gems:"))
        ui.waitUntil("'${expected.displayName}' is the first latest gem") {
            ui.firstTextOrNull(latestGem) == expected.displayName
        }
    }

    @Test
    fun scenario7a_noPlacesNearby() {
        assertNull("Precondition: no places near EMPTY_AREA", data.firstCandidate(E2EConfig.EMPTY_AREA))
        mockLocation.moveTo(E2EConfig.EMPTY_AREA)
        ui.launchDashboard()
        // Steps 1-6, without a filter.
        openPlaceList()
        // 7a1. The message "No gem candidates found! Check back later" with an "Ok" button.
        ui.displayed(hasText(NO_CANDIDATES))
        // 7a2. The user taps "Ok" and the app closes the sheet.
        ui.displayed(hasText("Ok")).performClick()
        ui.waitUntilGone(hasText(NO_CANDIDATES))
        ui.waitUntilGone(hasTestTag(TestTags.SUBMIT_BUTTON))
    }

    @Test
    fun scenario9a_placeBecameGemMeanwhile() {
        ui.launchDashboard()
        // Steps 1-7, without a filter: the list of places is shown.
        openPlaceList()
        val taken = firstCandidateName()
        // 9a. Another user adds the same place as a gem after the list was shown.
        //     Done through the API with the test account, standing in for User B (see Testing.md).
        val place = checkNotNull(data.candidateNamed(area, taken)) { "'$taken' is not in GET /place/nearby" }
        api.addGem(place.name, area)
        // 8. The user taps that place in the list, and the sheet closes.
        ui.displayed(hasTestTag(TestTags.CANDIDATE_CARD) and hasText(taken)).performClick()
        ui.waitUntilGone(hasTestTag(TestTags.CANDIDATE_CARD))
        // 9a1. The app tells the user the place is already a gem: the toast "Error: Gem already exists."
        ui.waitForToast(ALREADY_A_GEM)
    }

    @Test
    fun scenario9b_userMovedAway() {
        ui.launchDashboard()
        // Steps 1-7, without a filter: the list of places is shown.
        openPlaceList()
        val first = firstCandidateName()
        // 9b. The user moves more than 200 m away from the place.
        val newArea = area.movedNorth(E2EConfig.MOVE_AWAY_M)
        mockLocation.moveTo(newArea)
        SystemClock.sleep(E2EConfig.LOCATION_SETTLE_MS)
        // 8. The user taps the place in the list, and the sheet closes.
        ui.displayed(hasTestTag(TestTags.CANDIDATE_CARD) and hasText(first)).performClick()
        ui.waitUntilGone(hasTestTag(TestTags.CANDIDATE_CARD))
        // 9b1. The app tells the user they are too far from the place: the toast "Error: Too far from place."
        ui.waitForToast(TOO_FAR)
    }

    // Steps 1, 3 and 6: open Discovery, tap "Add gem", tap "Submit" without choosing a filter.
    private fun openPlaceList() {
        ui.tapNav(AppDriver.DISCOVERY)
        ui.displayed(hasContentDescription(AppDriver.ADD_GEM)).performClick()
        ui.displayed(hasTestTag(TestTags.SUBMIT_BUTTON)).performClick()
    }

    /** The name on the first card in the list of places, once the list has loaded. */
    private fun firstCandidateName(): String = ui.textOf(hasTestTag(TestTags.CANDIDATE_CARD))

    private companion object {
        /** As the app spells it (NearbyGemsOptionsList). */
        const val NO_CANDIDATES = "No gem candididates found! Check back later"

        /** The server's messages for POST /gem, which the app shows in its error toast. */
        const val ALREADY_A_GEM = "Gem already exists."
        const val TOO_FAR = "Too far from place."
    }
}
