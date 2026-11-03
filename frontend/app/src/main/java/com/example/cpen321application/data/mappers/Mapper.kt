package com.example.cpen321application.data.mappers


// Map an object of domain type D to DTO type T
interface Mapper<D,T> {

    fun toDTO(domainObject: D): T

    fun toDomain(dtoObject: T): D
}