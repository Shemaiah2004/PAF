package com.server.server.ticketing.dto.response;

import com.server.server.ticketing.enums.NotificationType;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long id,
        NotificationType type,
        String title,
        String message,
        boolean read,
        Long ticketId,
        LocalDateTime createdAt
) {
}
