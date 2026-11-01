package com.example.cpen321application.domain.repositories


import com.example.cpen321application.data.entities.Gem
import kotlinx.coroutines.flow.Flow

interface GemRepository {

    suspend fun getGems(): Flow<List<Gem>>
    suspend fun getNewestGems(numGems: UInt): Flow<List<Gem>>

    suspend fun addGem(gem: Gem)

}