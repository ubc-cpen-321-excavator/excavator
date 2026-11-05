package com.example.cpen321application.domain.usecases.gem.favorites

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class AddFavoriteGemUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<AddFavoriteGemUseCase.Params, Flow<Gem>> () {

    data class Params (
        val gemID: String
    )

    override suspend fun invoke(parameters: Params): Flow<Gem> {
        return repository.addFavoriteGem(parameters.gemID)
    }

}