package com.example.cpen321application.domain.usecases.gem.favorites

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetFavoriteGemsUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<Unit, Flow<List<Gem>>>() {

    override suspend fun invoke(parameters: Unit): Flow<List<Gem>> {
        return repository.getFavoritesGems()
    }

}