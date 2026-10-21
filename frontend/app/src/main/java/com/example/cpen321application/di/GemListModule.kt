package com.example.cpen321application.di

import com.example.cpen321application.data.repositories.GemRepositoryImpl
import com.example.cpen321application.domain.repositories.GemRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton


@Module
@InstallIn(SingletonComponent::class)
object GemListModule {

    // Crucial note for later about dagger hilt:
    // If a "provides" function takes an interface as an argument, then define the provides function
    // for that interface above the dependent "provides" function and then simply add the interface
    // to the dependent's parameter list.
    // NOTE: Once an example of this has been implemented here, this comment can be removed

    @Provides
    @Singleton
    fun provideGemRepository(): GemRepository {
        return GemRepositoryImpl()
    }

}