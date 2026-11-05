package com.example.cpen321application.data.remote

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.remote.Constants.Companion.GEM_BASE_ENDPOINT
import com.example.cpen321application.data.remote.Constants.Companion.NEARBY_GEMS_ENDPOINT
import com.example.cpen321application.data.remote.Constants.Companion.NEARBY_PLACES_ENDPOINT
import com.example.cpen321application.data.remote.Constants.Companion.NEWEST_GEMS_ENDPOINT
import com.example.cpen321application.data.remote.Constants.Companion.USER_FAVORITE_GEMS_DETAIL_ENDPOINT
import com.example.cpen321application.data.remote.Constants.Companion.USER_FAVORITE_GEMS_ENDPOINT
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query


interface GemAPIService {

    @GET(NEWEST_GEMS_ENDPOINT)
    suspend fun getNewestGems() : Response<List<GemDTO>>

    @POST(GEM_BASE_ENDPOINT)
    @Headers("Content-Type: application/json")
    suspend fun postGem(@Body body: NewGemRequestBody): Response<GemDTO>

    // Note: There are optional query parameters
    // radius<Int>: Search radius in meters
    // limit<Int>: Number of gems to return
    @GET(NEARBY_GEMS_ENDPOINT)
    suspend fun getNearestGems(
        @Query("lat") latitude: Double,
        @Query("lng") longitude: Double,
    ) : Response<List<GemDTO>>


    @GET(NEARBY_PLACES_ENDPOINT)
    suspend fun getNearestGemCandidates(
        @Query("lat") latitude: Double,
        @Query("lng") longitude: Double,
    ) : Response<List<GemCandidate>>

    @GET(USER_FAVORITE_GEMS_ENDPOINT)
    suspend fun getFavoriteGems() : Response<List<GemDTO>>

    @POST(USER_FAVORITE_GEMS_ENDPOINT)
    @Headers("Content-Type: application/json")
    suspend fun postFavoriteGem(@Body favGemRequestBody: FavGemRequestBody) : Response<GemDTO>

    @DELETE(USER_FAVORITE_GEMS_DETAIL_ENDPOINT)
    suspend fun deleteFavoriteGem(
        @Path(value="placeId", encoded = true) placeId: String
    ) : Response<Unit>

}

data class FavGemRequestBody(val gem: String)
data class NewGemRequestBody(
    val name: String,
    val latitiude: Double,
    val longitude: Double
)

