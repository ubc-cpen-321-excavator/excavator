package com.example.cpen321application.data.repositories

import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.error.APIErrorResponse
import com.google.gson.Gson
import com.google.gson.JsonParseException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

abstract class BaseRemoteRepo {

    // we'll use this function in all
    // repos to handle api errors.
    suspend fun <D,T> safeApiCall(mapper: Mapper<D,T>? = null, apiToBeCalled: suspend () -> Response<T>): Resource<Flow<D>> {

        // Returning api response
        // wrapped in Resource class
        return withContext(Dispatchers.IO) {
            callAndCatch(mapper, apiToBeCalled)
        }
    }

    // If you don't wanna handle api's own
    // custom error response then ignore this function
    protected fun convertErrorBody(errorBody: ResponseBody?): APIErrorResponse? {
        return try {
            errorBody?.charStream()?.use { reader ->
                Gson().fromJson(reader, APIErrorResponse::class.java)
            }
        } catch (exception: JsonParseException) {
            // The error body is not the JSON we expect (Gson's JsonSyntaxException / JsonIOException)
            null
        } catch (exception: IOException) {
            // The error body could not be read
            null
        }
    }

    protected suspend fun <D,T> callAndCatch(mapper: Mapper<D,T>?,apiToBeCalled: suspend () -> Response<T>): Resource<Flow<D>> {

        return try {
            makeApiCall(mapper, apiToBeCalled)
        } catch (e: HttpException) {
            // Returning HttpException's message
            // wrapped in Resource.Error
            Resource.Error(errorMessage = e.message ?: "Something went wrong")
        } catch (e: IOException) {
            // Returning no internet message
            // wrapped in Resource.Error
            Resource.Error("Please check your network connection")
        } catch (e: Exception) {
            // Returning 'Something went wrong' in case
            // of unknown error wrapped in Resource.Error
            Resource.Error(errorMessage = "Something went wrong")
        }

    }

    protected open suspend fun <D,T> makeApiCall(mapper: Mapper<D,T>?, apiToBeCalled: suspend () -> Response<T>): Resource<Flow<D>> {
        // Here we are calling api lambda
        // function that will return response
        // wrapped in Retrofit's Response class
        val response: Response<T> = apiToBeCalled()
        var returnedResource: Resource<Flow<D>>

        if (response.isSuccessful) {

            // Design choice: If there is a response body, it MUST have a mapper
            val responseData = if (response.body() != null ){
                MutableStateFlow(mapper!!.toDomain(response.body()!!))
            } else {null}

            returnedResource = Resource.Success(
                data = responseData
            )

        } else {
            val errorResponse: APIErrorResponse? = convertErrorBody(response.errorBody())
            // Simply returning api's own failure message
            returnedResource = Resource.Error(errorMessage = errorResponse?.message ?: "Something went wrong")
        }

        return returnedResource
    }

}