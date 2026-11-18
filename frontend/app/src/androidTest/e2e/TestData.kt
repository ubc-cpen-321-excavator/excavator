package e2e

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection

/**
 * Creates and cleans up the data the tests need, through the backend's authenticated API as the
 * signed-in user. Gems cannot be deleted through the API, so it reuses the user's own gems wherever
 * it can, and only adds a gem when a scenario needs a new one (see Testing.md, "Data left behind").
 */
class TestData(private val api: BackendClient) {

    private val profile by lazy { api.me() }
    private val favoritesBackup = File(DeviceControl.appContext.filesDir, FAVORITES_BACKUP_FILE)

    val userId: String get() = profile.getString("id")
    val displayName: String get() = profile.optString("displayName")

    /** The first test area that still has a place which is not a gem yet, optionally of [type]. */
    fun areaWithCandidates(type: String? = null): GeoPoint =
        checkNotNull(E2EConfig.TEST_AREAS.firstOrNull { firstCandidate(it, type) != null }) {
            "No place left to add as a gem in any test area (type=$type). See Testing.md, \"Data left behind\"."
        }

    /** The nearest place within 200 m of [area] that is not a gem yet, as the app should list it first. */
    fun firstCandidate(area: GeoPoint, type: String? = null): ApiPlace? =
        api.nearbyPlaces(area, type).firstOrNull { !it.isGem }

    /** The place near [area] with this display name that is not a gem yet. */
    fun candidateNamed(area: GeoPoint, displayName: String): ApiPlace? =
        api.nearbyPlaces(area).firstOrNull { !it.isGem && it.displayName == displayName }

    /** A gem this user added near [area]: an existing one is reused, otherwise one is added now. */
    fun ownGemNear(area: GeoPoint): ApiGem = api.gemsNear(area).firstOrNull { it.addedBy == userId } ?: addGemAt(area)

    /** The gem most Comment and Favorites tests reuse. */
    fun sharedGem(): ApiGem = ownGemNear(E2EConfig.SHARED_GEM_AREA)

    /** A gem added just now, so it has no comments yet. Each call adds one gem that stays behind. */
    fun freshGem(): ApiGem = addGemAt(areaWithCandidates())

    /**
     * Saves the user's favorites to a file on the device, so they can be put back even if a test
     * crashes. If an earlier test crashed before restoring, its backup is restored first.
     */
    fun backUpFavorites() {
        restoreFavorites()
        favoritesBackup.writeText(JSONArray(api.favoriteNames()).toString())
    }

    /** Puts the favorites back as they were at [backUpFavorites]: extras removed, missing ones re-added. */
    fun restoreFavorites() {
        if (!favoritesBackup.exists()) return
        val savedArray = JSONArray(favoritesBackup.readText())
        val saved = (0 until savedArray.length()).map(savedArray::getString)
        val current = api.favoriteNames()
        current.filterNot { it in saved }.forEach(api::removeFavorite)
        // Re-added oldest first, so they come back in the same order (most recent first).
        saved.filterNot { it in current }.asReversed().forEach(api::addFavorite)
        favoritesBackup.delete()
    }

    fun removeAllFavorites() {
        api.favoriteNames().forEach(api::removeFavorite)
    }

    /**
     * Seeding hook for Use case 5, step 4a: makes the signed-in user have exactly [count] favorites,
     * by calling the data-population endpoint (BackendClient.SEED_FAVORITES_PATH). The user must have
     * no favorites before the call. Until that endpoint exists, the backend answers 404 and the test
     * reports that it is blocked.
     */
    fun seedFavorites(count: Int) {
        val result = api.seedFavorites(count)
        if (result.code == HttpURLConnection.HTTP_NOT_FOUND) {
            throw AssertionError("$SEED_BLOCKED (${BackendClient.SEED_FAVORITES_PATH} is not available)")
        }
        check(result.code == HttpURLConnection.HTTP_OK) { "Seed script failed: ${result.code} ${result.body}" }
        val total = JSONObject(result.body).getInt("favoriteCount")
        check(total == count) { "Seed script left $total favorites, expected $count" }
    }

    private fun addGemAt(area: GeoPoint): ApiGem {
        val place = checkNotNull(firstCandidate(area)) { "No place left to add as a gem near $area" }
        return api.addGem(place.name, area)
    }

    private companion object {
        const val FAVORITES_BACKUP_FILE = "e2e-favorites-backup.json"
        const val SEED_BLOCKED = "blocked: waiting for the seed script"
    }
}
