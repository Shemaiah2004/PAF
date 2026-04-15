package com.server.server.ticketing.dto.response;

import com.server.server.ticketing.enums.TicketActivityAction;

import java.time.LocalDateTime;

public record TicketActivityResponse(
        Long id,
        TicketActivityAction action,
        String message,
        String fromStatus,
        String toStatus,
        String previousAssigneeName,
        String newAssigneeName,
        boolean internalOnly,
        UserSummaryResponse actor,
        LocalDateTime createdAt
) {
}
