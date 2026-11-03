    package com.example.cpen321application.di

    import com.example.cpen321application.domain.models.Gem
    import com.example.cpen321application.data.mappers.GemMapper
    import com.example.cpen321application.data.mappers.Mapper
    import com.example.cpen321application.data.remote.GemDTO
    import dagger.Module
    import dagger.Provides
    import dagger.hilt.InstallIn
    import dagger.hilt.components.SingletonComponent
    import javax.inject.Qualifier
    import javax.inject.Singleton


    @Qualifier
    @Retention(AnnotationRetention.BINARY)
    annotation class InjectGemMapper


    @Module
    @InstallIn(SingletonComponent::class)
    object MapperModule {

        @InjectGemMapper
        @Provides
        @Singleton
        fun provideGemMapper() : Mapper<Gem, GemDTO> {
            return GemMapper()
        }

    }