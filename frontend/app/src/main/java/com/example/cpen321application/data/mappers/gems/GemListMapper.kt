package com.example.cpen321application.data.mappers.gems

import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.di.InjectGemMapper
import com.example.cpen321application.domain.models.Gem

class GemListMapper(
    @param:InjectGemMapper private val mapper: Mapper<Gem, GemDTO>
) : Mapper<List<Gem>, List<GemDTO>> {

    override fun toDTO(domainObject: List<Gem>): List<GemDTO> {
        return domainObject.map {
            mapper.toDTO(it)
        }
    }

    override fun toDomain(dtoObject: List<GemDTO>): List<Gem> {
        return dtoObject.map {
            mapper.toDomain(it)
        }
    }


}