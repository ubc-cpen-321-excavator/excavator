package com.example.cpen321application.data.remote

import com.example.cpen321application.data.dto.GemDTO
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Query

private const val GEM_BASE_ENDPOINT = "/gem"
private const val NEWEST_GEMS_ENDPOINT = "$GEM_BASE_ENDPOINT/newest"

private const val NEARBY_GEMS_ENDPOINT = "$GEM_BASE_ENDPOINT/nearby"
interface GemAPIService {

    @GET(NEWEST_GEMS_ENDPOINT)
    suspend fun getNewestGems() : Response<List<GemDTO>>

    @POST(GEM_BASE_ENDPOINT)
    @Headers("Content-Type: application/json")
    suspend fun postGem(@Body body: GemDTO): Response<GemDTO>

    // Note: There are optional query parameters
    // radius<Int>: Search radius in meters
    // limit<Int>: Number of gems to return
    @GET(NEARBY_GEMS_ENDPOINT)
    suspend fun getNearestGems(
        @Query("lat") latitude: Double,
        @Query("lng") longitude: Double,
    ) : Response<List<GemDTO>>

}

