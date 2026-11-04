package com.example.cpen321application.domain.usecases.gem

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import com.google.android.gms.maps.model.LatLng

import javax.inject.Inject

class AddGemUseCase @Inject constructor(
    private val repository: GemRepository
): BaseUseCase<AddGemUseCase.Params, Result<Unit>>(){

    data class Params (
        val title: String,
        val coords: LatLng,
        val placesName: String
    )

    override suspend fun invoke(parameters: Params): Result<Unit> {

        repository.addGem(
            Gem(
                title = parameters.title,
                coords = parameters.coords,
                placesName = parameters.placesName
            )
        )

        return Result.success(Unit)
    }
}