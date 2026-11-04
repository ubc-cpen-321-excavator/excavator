package com.example.cpen321application.domain.usecases.gem

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetNewestGemsUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<Unit, Flow<List<Gem>>>() {

    private val numNewestGems = 6u;

    override suspend fun invoke(parameters: Unit): Flow<List<Gem>> {
        return repository.getNewestGems(numNewestGems)
    }


}