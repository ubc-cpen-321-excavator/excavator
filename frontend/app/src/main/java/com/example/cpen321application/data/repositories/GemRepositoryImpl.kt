package com.example.cpen321application.data.repositories

import androidx.compose.runtime.mutableStateOf
import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

class GemRepositoryImpl : GemRepository {

    private val gems = MutableStateFlow<List<Gem>>(
        listOf(
            Gem("gem1"),
            Gem("gem2"),
            Gem("gem3"),
            Gem("gem4"),
            Gem("gem5"),
        )
    )


    override suspend fun getGems(): Flow<List<Gem>> {
        return gems.asStateFlow()
    }

    override suspend fun getNewestGems(numGems: UInt): Flow<List<Gem>> {
        return gems
            .map { gems -> gems.sortedByDescending { it.dateTimeCreated } }
    }

    override suspend fun addGem(gem: Gem) {

        gems.update { it + gem }

    }

}