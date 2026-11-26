package com.example.cpen321application.di

import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.dto.NewGemRatingDTO
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.GemAPIService
import com.example.cpen321application.data.repositories.GemRepositoryImpl
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.models.NewGemRating
import com.example.cpen321application.domain.repositories.GemRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton


@Module
@InstallIn(SingletonComponent::class)
object GemModule {

    @Provides
    @Singleton
    fun provideGemRepository(
        gemAPIService: GemAPIService,
        @InjectGemMapper gemMapper: Mapper<Gem,GemDTO>,
        @InjectGemListMapper gemListMapper: Mapper<List<Gem>,List<GemDTO>>,
        @InjectGemCandidatesMapper gemCandidatesMapper: Mapper<List<GemCandidate>, List<GemCandidate>>,
        @InjectNewGemRatingMapper gemRatingMapper: Mapper<NewGemRating, NewGemRatingDTO>

    ): GemRepository {
        return GemRepositoryImpl(
            service = gemAPIService,
            mapper = gemMapper,
            listMapper = gemListMapper,
            candidatesMapper = gemCandidatesMapper,
            gemRatingMapper = gemRatingMapper
        )
    }

}