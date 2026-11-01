package com.example.cpen321application.domain.usecases

import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetNewestGemsUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<Unit, Flow<List<Gem>>>() {

    private val numNewestGems = 3u;

    override suspend fun invoke(parameters: Unit): Flow<List<Gem>> {
        return repository.getNewestGems(numNewestGems)
    }


}