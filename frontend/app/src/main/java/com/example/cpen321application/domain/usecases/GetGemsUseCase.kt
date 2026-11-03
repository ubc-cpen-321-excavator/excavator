package com.example.cpen321application.domain.usecases

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject


class GetGemsUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<Unit, Flow<List<Gem>>>() {

    override suspend operator fun invoke(parameters: Unit): Flow<List<Gem>> {
        return repository.getGems()
    }

}