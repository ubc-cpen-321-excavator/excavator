package com.example.cpen321application.domain.repositories


import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.remote.NewGemRequestBody
import com.example.cpen321application.data.repositories.Resource
import com.example.cpen321application.domain.models.Gem
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow

interface GemRepository {

    suspend fun getNearbyGems(coords: LatLng): Resource<Flow<List<Gem>>>
    suspend fun getNewestGems(numGems: UInt?): Resource<Flow<List<Gem>>>
    suspend fun addGem(gem: NewGemRequestBody): Resource<Flow<Gem>>

    suspend fun getGemCandidates(coords: LatLng, filters: String?): Resource<Flow<List<GemCandidate>>>

    suspend fun getFavoritesGems(): Resource<Flow<List<Gem>>>

    suspend fun addFavoriteGem(gemID: String): Resource<Flow<Gem>>

    suspend fun deleteFavoriteGem(placesID: String)

}