package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.FavGemRequestBody
import com.example.cpen321application.data.remote.GemAPIService
import com.example.cpen321application.data.remote.NewGemRequestBody
import com.example.cpen321application.di.InjectGemCandidatesMapper
import com.example.cpen321application.di.InjectGemListMapper
import com.example.cpen321application.di.InjectGemMapper
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GemRepositoryImpl @Inject constructor(
    private val service: GemAPIService,
    @param:InjectGemMapper private val mapper: Mapper<Gem, GemDTO>,
    @param:InjectGemListMapper private val listMapper: Mapper<List<Gem>, List<GemDTO>>,
    @param:InjectGemCandidatesMapper private val candidatesMapper: Mapper<List<GemCandidate>, List<GemCandidate>>
): GemRepository, BaseRemoteRepo() {

    override suspend fun getNearbyGems(coords: LatLng): Resource<Flow<List<Gem>>> {

        return safeApiCall (listMapper) {
            service.getNearestGems(coords.latitude, coords.longitude)
        }

    }

    override suspend fun getNewestGems(numGems: UInt?): Resource<Flow<List<Gem>>> {

        return safeApiCall(listMapper) {
            service.getNewestGems()
        }

    }

    override suspend fun addGem(gem: NewGemRequestBody) : Resource<Flow<Gem>> {

        return safeApiCall(mapper) {
            service.postGem(gem)
        }

    }

    override suspend fun getGemCandidates(coords: LatLng): Resource<Flow<List<GemCandidate>>> {

        return safeApiCall(candidatesMapper) {
            service.getNearestGemCandidates(coords.latitude, coords.longitude)
        }

    }

    override suspend fun getFavoritesGems(): Resource<Flow<List<Gem>>> {

        return safeApiCall(listMapper) {
            service.getFavoriteGems()
        }

    }

    override suspend fun addFavoriteGem(gemID: String): Resource<Flow<Gem>> {

        return safeApiCall(mapper) {
            service.postFavoriteGem(FavGemRequestBody(gemID))
        }

    }

    override suspend fun deleteFavoriteGem(placesID: String) {

        safeApiCall <Unit,Unit> {
            service.deleteFavoriteGem(placesID)
        }

    }


}