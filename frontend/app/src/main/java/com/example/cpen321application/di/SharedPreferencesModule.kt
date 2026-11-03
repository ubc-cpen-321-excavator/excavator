package com.example.cpen321application.di

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.ContextCompat.getString

import com.example.cpen321application.R
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SharedPreferencesModule {

    @Singleton
    @Provides
    fun provideSharedPreferences(@ApplicationContext context: Context) : SharedPreferences {
        return context.getSharedPreferences (
            getString(context,R.string.prefs_auth),
            Context.MODE_PRIVATE
        )
    }

}