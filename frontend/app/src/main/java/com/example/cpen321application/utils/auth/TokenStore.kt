package com.example.cpen321application.utils.auth

import android.content.SharedPreferences
import androidx.core.content.edit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenStore @Inject constructor(
    private val sharedPreferences: SharedPreferences
){

    fun saveToken(token: String) = sharedPreferences.edit { putString(KEY_JWT, token) }

    fun getToken(): String? = sharedPreferences.getString(KEY_JWT, null)

    fun clear() = sharedPreferences.edit { remove(KEY_JWT) }

    private companion object {
        const val KEY_JWT = "jwt"
    }

}