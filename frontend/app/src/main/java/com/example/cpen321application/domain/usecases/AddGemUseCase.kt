package com.example.cpen321application.domain.usecases

import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.google.android.gms.maps.model.LatLng

import javax.inject.Inject

class AddGemUseCase @Inject constructor(
    private val repository: GemRepository
): BaseUseCase<AddGemUseCase.Params, Result<Unit>>(){

    data class Params (
        val title: String,
        val coords: LatLng
    )

    override suspend fun invoke(parameters: Params): Result<Unit> {

        repository.addGem(
            Gem(
                title = parameters.title,
                coords = parameters.coords
            )
        )

        return Result.success(Unit)
    }
}