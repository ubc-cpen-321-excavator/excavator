package com.example.cpen321application.data.mappers

import com.example.cpen321application.domain.models.Comment

class CommentMapper: Mapper<Comment, Comment> {
    override fun toDTO(domainObject: Comment): Comment {
        return domainObject
    }

    override fun toDomain(dtoObject: Comment): Comment {
        return dtoObject
    }

}