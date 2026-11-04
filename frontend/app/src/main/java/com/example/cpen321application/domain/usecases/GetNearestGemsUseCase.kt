package com.example.cpen321application.domain.usecases

import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject


class GetNearestGemsUseCase @Inject constructor(
    private val repository: GemRepository
) : BaseUseCase<GetNearestGemsUseCase.Params, Flow<List<Gem>>>() {

    data class Params (
        val coords: LatLng
    )

    override suspend operator fun invoke(parameters: Params): Flow<List<Gem>> {
        return repository.getNearbyGems(parameters.coords)
    }

}