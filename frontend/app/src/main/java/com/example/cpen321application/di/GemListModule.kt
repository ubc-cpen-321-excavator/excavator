package com.example.cpen321application.di

import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.GemMapper
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.GemAPIService
import com.example.cpen321application.data.repositories.GemRepositoryImpl
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.repositories.GemRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton


@Module
@InstallIn(SingletonComponent::class)
object GemListModule {

    @Provides
    @Singleton
    fun provideGemRepository(
        gemAPIService: GemAPIService,
        @InjectGemMapper gemMapper: Mapper<Gem,GemDTO>): GemRepository {
        return GemRepositoryImpl(gemAPIService, gemMapper)
    }

}