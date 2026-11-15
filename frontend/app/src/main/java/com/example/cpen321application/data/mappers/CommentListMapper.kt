package com.example.cpen321application.data.mappers

import com.example.cpen321application.domain.models.Comment

class CommentListMapper() : Mapper<List<Comment>, List<Comment>> {

    override fun toDTO(domainObject: List<Comment>): List<Comment> {
        return domainObject
    }

    override fun toDomain(dtoObject: List<Comment>): List<Comment> {
        return dtoObject
    }
}