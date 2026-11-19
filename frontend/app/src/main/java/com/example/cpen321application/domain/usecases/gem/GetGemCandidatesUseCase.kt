package com.example.cpen321application.domain.usecases.gem

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.repositories.Resource
import com.example.cpen321application.domain.repositories.GemRepository
import com.example.cpen321application.domain.usecases.BaseUseCase
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetGemCandidatesUseCase @Inject constructor (
    private val repository: GemRepository
): BaseUseCase<GetGemCandidatesUseCase.Params, Resource<Flow<List<GemCandidate>>>>() {

    data class Params (
        val coords: LatLng,
        val filters: String?
    )

    override suspend fun invoke(parameters: Params): Resource<Flow<List<GemCandidate>>> {
        return repository.getGemCandidates(parameters.coords,parameters.filters)
    }


}