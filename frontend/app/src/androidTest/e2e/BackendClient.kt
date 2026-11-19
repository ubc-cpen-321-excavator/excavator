package e2e

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Calls the real backend as the signed-in user, to create and clean up test data. It uses the app's
 * base URL and the user's own token, and only the authenticated public API (plus the seed endpoint
 * behind [seedFavorites]). It never touches the database directly.
 */
class BackendClient(baseUrl: String, private val token: String) {

    private val base = URL(baseUrl)

    /** Fails with a clear message if the stored session is no longer accepted. */
    fun checkSession() {
        val result = send("GET", "/user/me")
        check(result.code != HttpURLConnection.HTTP_UNAUTHORIZED) {
            "The app's session has expired: open the app, sign in again, then rerun the tests."
        }
    }

    fun me(): JSONObject = JSONObject(request("GET", "/user/me").body)

    fun nearbyPlaces(at: GeoPoint, type: String? = null): List<ApiPlace> {
        val typeParam = type?.let { "&type=$it" }.orEmpty()
        return JSONArray(request("GET", "/place/nearby?${latLng(at)}$typeParam").body)
            .objects()
            .map(ApiPlace::from)
    }

    /**
     * The gems within 200 m of [at], nearest first, at most as many as the app loads for its map
     * (it calls GET /gem/nearby without a limit, so it gets the backend's default of 20). Each gem
     * returned here is therefore one the app also shows when the user is at [at].
     */
    fun gemsNear(at: GeoPoint): List<ApiGem> {
        val path = "/gem/nearby?${latLng(at)}&radius=${E2EConfig.NEARBY_RADIUS_M}&limit=$NEARBY_LIMIT"
        return JSONArray(request("GET", path).body).objects().map(ApiGem::from)
    }

    /** Adds [placeName] as a gem, with the user standing at [userLocation] (POST /gem). */
    fun addGem(placeName: String, userLocation: GeoPoint): ApiGem {
        val body = JSONObject()
            .put("name", placeName)
            .put("latitude", userLocation.latitude)
            .put("longitude", userLocation.longitude)
        return ApiGem.from(JSONObject(request("POST", "/gem", body, setOf(HttpURLConnection.HTTP_CREATED)).body))
    }

    /** The bodies of a gem's comments, oldest first. */
    fun commentBodies(gem: ApiGem): List<String> =
        JSONArray(request("GET", "/gem/${placeId(gem.name)}/comments").body)
            .objects()
            .map { it.getString("body") }

    /** The names of the user's favorite gems, most recently added first. */
    fun favoriteNames(): List<String> =
        JSONArray(request("GET", "/user/favorites").body).objects().map { it.getString("name") }

    fun addFavorite(gemName: String) {
        val body = JSONObject().put("gem", gemName)
        request("POST", "/user/favorites", body, setOf(HttpURLConnection.HTTP_CREATED, HttpURLConnection.HTTP_OK))
    }

    /** Removes a favorite; does nothing if it is not one. */
    fun removeFavorite(gemName: String) {
        val path = "/user/favorites/${placeId(gemName)}"
        request("DELETE", path, null, setOf(HttpURLConnection.HTTP_NO_CONTENT, HttpURLConnection.HTTP_NOT_FOUND))
    }

    /** Asks the backend's data-population endpoint to seed favorites; see TestData.seedFavorites. */
    fun seedFavorites(count: Int): HttpResult = send("POST", SEED_FAVORITES_PATH, JSONObject().put("count", count))

    private fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        expected: Set<Int> = setOf(HttpURLConnection.HTTP_OK),
    ): HttpResult {
        val result = send(method, path, body)
        check(result.code in expected) { "$method $path returned ${result.code}: ${result.body}" }
        return result
    }

    private fun send(method: String, path: String, body: JSONObject? = null): HttpResult {
        // Resolved like the app's Retrofit paths: an absolute path replaces any path in the base URL.
        val connection = URL(base, path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val code = connection.responseCode
            val failed = code >= HttpURLConnection.HTTP_BAD_REQUEST
            val stream = if (failed) connection.errorStream else connection.inputStream
            return HttpResult(code, stream?.bufferedReader()?.use { it.readText() }.orEmpty())
        } finally {
            connection.disconnect()
        }
    }

    private fun latLng(at: GeoPoint) = "lat=${at.latitude}&lng=${at.longitude}"

    private fun placeId(gemName: String) = gemName.removePrefix("places/")

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

    companion object {
        /** The authenticated endpoint the data-population script provides (see the seed contract). */
        const val SEED_FAVORITES_PATH = "/e2e/seed/favorites"

        /** The backend's default `limit` for GET /gem/nearby, which is what the app's map gets. */
        private const val NEARBY_LIMIT = 20
        private const val TIMEOUT_MS = 30_000
    }
}
