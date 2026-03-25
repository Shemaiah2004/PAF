package com.server.server.user.dto;

public record RoleRequestMutationResponse(
        String message,
        RoleRequestItemResponse request,
        UserTableItemResponse user) {
}
