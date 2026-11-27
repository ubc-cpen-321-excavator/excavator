package e2e

import com.example.cpen321application.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** A gem as the app shows it: [title] is its place's display name, else its name (see GemMapper). */
data class ApiGem(val name: String, val title: String)

/**
 * Calls the app's backend as the signed-in user. The tests only use it to set up and clean up data
 * around what they do through the UI, or to pick the data a test needs, never to check results.
 */
class BackendClient(private val token: String) {

    private val base = URL(BuildConfig.API_BASE_URL)

    /** The gems the Dashboard lists under "Latest Gems:", newest first (GET /gem/newest). */
    fun newestGems(): List<ApiGem> {
        val gems = JSONArray(request("GET", "/gem/newest", setOf(HttpURLConnection.HTTP_OK)))
        return (0 until gems.length()).map { toApiGem(gems.getJSONObject(it)) }
    }

    /** How many comments a gem has (GET /gem/:pk/comments). */
    fun commentCount(gemName: String): Int {
        val placeId = gemName.removePrefix("places/")
        return JSONArray(request("GET", "/gem/$placeId/comments", setOf(HttpURLConnection.HTTP_OK))).length()
    }

    /** Removes a gem from the user's favorites; does nothing if it is not one. */
    fun removeFavorite(gemName: String) {
        val placeId = gemName.removePrefix("places/")
        request(
            "DELETE",
            "/user/favorites/$placeId",
            setOf(HttpURLConnection.HTTP_OK, HttpURLConnection.HTTP_NO_CONTENT, HttpURLConnection.HTTP_NOT_FOUND),
        )
    }

    private fun toApiGem(json: JSONObject): ApiGem {
        val name = json.getString("name")
        val place = json.optJSONObject("place")
        val displayName = if (place == null || place.isNull("displayName")) null else place.optString("displayName")
        return ApiGem(name = name, title = displayName ?: name)
    }

    private fun request(method: String, path: String, expected: Set<Int>): String {
        // Resolved like the app's Retrofit paths: an absolute path replaces any path in the base URL.
        val connection = URL(base, path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Accept", "application/json")
            val code = connection.responseCode
            val stream = if (code >= HttpURLConnection.HTTP_BAD_REQUEST) connection.errorStream else connection.inputStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            check(code in expected) { "$method $path returned $code: $body" }
            return body
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        const val TIMEOUT_MS = 30_000
    }
}
