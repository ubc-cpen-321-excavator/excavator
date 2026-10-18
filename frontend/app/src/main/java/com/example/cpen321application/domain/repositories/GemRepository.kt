package com.example.cpen321application.domain.repositories


import com.example.cpen321application.domain.entities.Gem
import kotlinx.coroutines.flow.Flow

interface GemRepository {
    suspend fun getGems(): Flow<List<Gem>>
}