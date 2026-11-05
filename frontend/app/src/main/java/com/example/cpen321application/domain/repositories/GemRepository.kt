package com.example.cpen321application.domain.repositories


import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.domain.models.Gem
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow

interface GemRepository {

    suspend fun getNearbyGems(coords: LatLng): Flow<List<Gem>>
    suspend fun getNewestGems(numGems: UInt): Flow<List<Gem>>
    suspend fun addGem(gem: Gem)

    suspend fun getGemCandidates(coords: LatLng): Flow<List<GemCandidate>>

    suspend fun getFavoritesGems(): Flow<List<Gem>>

    suspend fun addFavoriteGem(gemID: String): Flow<Gem>

    suspend fun deleteFavoriteGem(placesID: String)

}