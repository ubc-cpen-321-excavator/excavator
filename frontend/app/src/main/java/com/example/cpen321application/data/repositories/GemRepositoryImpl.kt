package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class GemRepositoryImpl : GemRepository {

    override suspend fun getGems(): Flow<List<Gem>> {

        // Return dummy values for now
        return flow {
            emit(listOf(
                Gem("Sample Gem 1", 34.345, 43.435),
                Gem("Sample Gem 2", 38.352, 49.452))
            )
        }
    }

}