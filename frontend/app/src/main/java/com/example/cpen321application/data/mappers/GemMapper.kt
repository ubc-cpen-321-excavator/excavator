package com.example.cpen321application.data.mappers

import android.R.attr.name
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.dto.Place
import com.example.cpen321application.domain.models.Gem
import com.google.android.gms.maps.model.LatLng


class GemMapper : Mapper<Gem, GemDTO>{

    override fun toDTO(domainObject: Gem): GemDTO {
        return GemDTO(
            name = domainObject.title,
            place = Place(
                name = domainObject.placesName,
                latitude = domainObject.coords.latitude,
                longitude = domainObject.coords.longitude
            )
        )
    }

    override fun toDomain(dtoObject: GemDTO): Gem {
        return Gem(
            title = dtoObject.name,
            coords = LatLng(
                dtoObject.place.latitude,
                dtoObject.place.longitude
            ),
            placesName = dtoObject.place.name
        )
    }

}