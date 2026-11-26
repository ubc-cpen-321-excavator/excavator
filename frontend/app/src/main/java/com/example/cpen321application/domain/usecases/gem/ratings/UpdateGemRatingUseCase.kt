package com.example.cpen321application.domain.usecases.gem.ratings

import com.example.cpen321application.data.remote.NewLocalRatingRequest
import com.example.cpen321application.data.repositories.Resource
import com.example.cpen321application.domain.models.NewGemRating
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class UpdateGemRatingUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<UpdateGemRatingUseCase.Params, Resource<Flow<NewGemRating>>>()
{
    data class Params(
        val pk: String,
        val gemRatingRequest: NewLocalRatingRequest
    )

    override suspend fun invoke(parameters: Params): Resource<Flow<NewGemRating>> {
        return repository.updateRating(
            pk = parameters.pk,
            newRating = parameters.gemRatingRequest
        )
    }


}