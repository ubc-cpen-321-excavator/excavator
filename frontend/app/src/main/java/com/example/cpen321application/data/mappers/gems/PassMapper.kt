package com.example.cpen321application.data.mappers.gems

import com.example.cpen321application.data.mappers.Mapper

abstract class PassMapper <T> : Mapper<T,T> {

    override fun toDTO(domainObject: T): T {
        return domainObject
    }

    override fun toDomain(dtoObject: T): T {
        return dtoObject
    }

}