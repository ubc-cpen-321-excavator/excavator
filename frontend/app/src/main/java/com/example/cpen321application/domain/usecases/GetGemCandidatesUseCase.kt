package com.example.cpen321application.domain.usecases

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.domain.repositories.GemRepository
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetGemCandidatesUseCase @Inject constructor (
    private val repository: GemRepository
): BaseUseCase <GetGemCandidatesUseCase.Params, Flow<List<GemCandidate>>>() {

    data class Params (
        val coords: LatLng
    )

    override suspend fun invoke(parameters: Params): Flow<List<GemCandidate>> {
        return repository.getGemCandidates(parameters.coords)
    }


}