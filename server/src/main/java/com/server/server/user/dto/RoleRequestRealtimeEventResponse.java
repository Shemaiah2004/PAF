package com.server.server.user.dto;

public record RoleRequestRealtimeEventResponse(
        RoleRequestRealtimeEventType eventType,
        String message,
        String actorUserId,
        String requestId,
        RoleRequestItemResponse request,
        UserTableItemResponse user) {
}
