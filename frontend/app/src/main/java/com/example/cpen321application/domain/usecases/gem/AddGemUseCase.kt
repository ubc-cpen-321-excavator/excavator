package com.example.cpen321application.domain.usecases.gem

import com.example.cpen321application.data.remote.NewGemRequestBody
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow

import javax.inject.Inject

class AddGemUseCase @Inject constructor(
    private val repository: GemRepository
): BaseUseCase<AddGemUseCase.Params, Flow<Gem>>(){

    data class Params (
        val title: String,
        val coords: LatLng,
    )

    override suspend fun invoke(parameters: Params): Flow<Gem> {

        return repository.addGem(
            NewGemRequestBody(
                parameters.title,
                parameters.coords.latitude,
                parameters.coords.longitude
            )

        )


    }
}