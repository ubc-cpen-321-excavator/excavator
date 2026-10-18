package com.example.cpen321application.data.repositories

import com.example.cpen321application.domain.entities.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import kotlinx.coroutines.flow.Flow

class GemRepositoryImpl : GemRepository {

    override suspend fun getGems(): Flow<List<Gem>> {
        TODO("Not yet implemented")
    }

}