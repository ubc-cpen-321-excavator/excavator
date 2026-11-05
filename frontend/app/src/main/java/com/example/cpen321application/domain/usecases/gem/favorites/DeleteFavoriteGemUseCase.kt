package com.example.cpen321application.domain.usecases.gem.favorites

import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import javax.inject.Inject

class DeleteFavoriteGemUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<DeleteFavoriteGemUseCase.Params, Unit> () {

    data class Params (
        val placesID: String
    )

    override suspend fun invoke(parameters: Params) {
         return repository.deleteFavoriteGem(
            parameters.placesID
        )
    }


}