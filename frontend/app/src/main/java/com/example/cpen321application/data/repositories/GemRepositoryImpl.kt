package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.GemMapper
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.FavGemRequestBody
import com.example.cpen321application.data.remote.GemAPIService
import com.example.cpen321application.data.remote.NewGemRequestBody
import com.example.cpen321application.di.InjectGemMapper
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import retrofit2.Response
import javax.inject.Inject

class GemRepositoryImpl @Inject constructor(
    private val service: GemAPIService,
    @param:InjectGemMapper private val mapper: Mapper<Gem, GemDTO>
): GemRepository {

    private fun responseBodyToFlow(responseBody:List<GemDTO>): Flow<List<Gem>>{
        return MutableStateFlow(
            responseBody.map {
                mapper.toDomain(it)
            }
        )
    }

    override suspend fun getNearbyGems(coords: LatLng): Flow<List<Gem>> {

        val response: Response<List<GemDTO>> = service.getNearestGems(
            coords.latitude,
            coords.longitude
        )

        if (response.isSuccessful) {
            return responseBodyToFlow(response.body()!!)
        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }

    }

    override suspend fun getNewestGems(numGems: UInt): Flow<List<Gem>> {
        val response: Response<List<GemDTO>> = service.getNewestGems()

        if (response.isSuccessful) {
            // We will always receive a valid response body if the response is successful
            return MutableStateFlow(
                response.body()!!.map {
                    mapper.toDomain(it)
                }
            ).asStateFlow()

        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }
    }

    override suspend fun addGem(gem: NewGemRequestBody) : Flow<Gem> {

        val response: Response<GemDTO> = service.postGem(
            gem
        )

        if (response.isSuccessful) {

            return MutableStateFlow(
                mapper.toDomain(response.body()!!)
            )

        } else {
                // TODO: Update this to be a more descriptive error
                throw Exception("Non 200 Response")
        }

    }

    override suspend fun getGemCandidates(coords: LatLng): Flow<List<GemCandidate>> {
        val response: Response<List<GemCandidate>> = service.getNearestGemCandidates(
            coords.latitude,
            coords.longitude
        )

        if (response.isSuccessful) {

            return MutableStateFlow(
                response.body()!!
            )

        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }
    }

    override suspend fun getFavoritesGems(): Flow<List<Gem>> {

        val response: Response<List<GemDTO>> = service.getFavoriteGems()

        if (response.isSuccessful) {

            return responseBodyToFlow(response.body()!!)

        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }

    }

    override suspend fun addFavoriteGem(gemID: String): Flow<Gem> {
        val response: Response<GemDTO> = service.postFavoriteGem(
            favGemRequestBody = FavGemRequestBody(gemID)
        )

        if (response.isSuccessful) {

            return MutableStateFlow(
                mapper.toDomain(response.body()!!)
            )

        } else {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }
    }

    override suspend fun deleteFavoriteGem(placesID: String) {
        val response: Response<Unit> = service.deleteFavoriteGem(
            placesID
        )

        if (!response.isSuccessful) {
            // TODO: Update this to be a more descriptive error
            throw Exception("Non 200 Response")
        }

    }


}