package com.example.cpen321application.data.mappers.gems

import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.dto.NewGemRatingDTO
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.di.InjectGemMapper
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.models.NewGemRating

class NewGemRatingMapper (
    @param:InjectGemMapper private val mapper: Mapper<Gem,GemDTO>
) : Mapper<NewGemRating, NewGemRatingDTO> {

    override fun toDTO(domainObject: NewGemRating): NewGemRatingDTO {
        return NewGemRatingDTO(
            stars = domainObject.stars,
            gem = mapper.toDTO(domainObject.gem)
        )
    }

    override fun toDomain(dtoObject: NewGemRatingDTO): NewGemRating {
        return NewGemRating(
            stars = dtoObject.stars,
            gem = mapper.toDomain(dtoObject.gem)
        )
    }
}