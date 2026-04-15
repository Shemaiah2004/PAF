package com.server.server.ticketing.dto.response;

public record TicketSummaryResponse(
        long total,
        long open,
        long assigned,
        long inProgress,
        long overdue,
        long resolved,
        long closed
) {
}
