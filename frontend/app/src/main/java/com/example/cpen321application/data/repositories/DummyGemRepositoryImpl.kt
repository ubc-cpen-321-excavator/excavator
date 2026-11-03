package com.example.cpen321application.data.repositories

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.update
import kotlin.math.min
import kotlin.random.Random

class DummyGemRepositoryImpl : GemRepository {


    private fun genRandomLatLng(): LatLng = LatLng(Random.nextDouble(1.0,50.0), Random.nextDouble(1.0, 50.0))

    private val gems = MutableStateFlow<List<Gem>>(
        listOf(
            Gem("gem1",genRandomLatLng(), placesName=""),
            Gem("gem2", genRandomLatLng(),placesName=""),
            Gem("gem3", genRandomLatLng(),placesName=""),
            Gem("gem4", genRandomLatLng(),placesName=""),
            Gem("gem5", genRandomLatLng(),placesName=""),
        )
    )


    override suspend fun getGems(): Flow<List<Gem>> {
        return gems.asStateFlow()
    }

    override suspend fun getNewestGems(numGems: UInt): Flow<List<Gem>> {
        return gems
            .map { gems -> gems.sortedByDescending { it.dateTimeCreated } }
            .take(min(numGems.toInt(),gems.value.size))
    }

    override suspend fun addGem(gem: Gem) {

        gems.update { it + gem }

    }

}