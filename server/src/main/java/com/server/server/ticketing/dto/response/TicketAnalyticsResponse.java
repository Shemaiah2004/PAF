package com.server.server.ticketing.dto.response;

import java.util.Map;

public record TicketAnalyticsResponse(
        Map<String, Long> monthlyCounts,
        Map<String, Long> typeBreakdown,
        Map<String, Long> categoryBreakdown,
        Map<String, Long> priorityBreakdown,
        Map<String, Long> statusBreakdown,
        double averageResolutionHours,
        long overdueCount,
        Map<String, Long> technicianWorkload
) {
}
