package com.server.server.ticketing.dto;

import java.util.List;

public record TicketReportsResponse(
        Summary summary,
        List<CountBucket> categoryBreakdown,
        List<CountBucket> technicianWorkload,
        List<CountBucket> typeBreakdown) {

    public record Summary(
            long averageResolutionHours,
            long slaBreachedTickets,
            long slaMetTickets) {
    }

    public record CountBucket(
            String _id,
            long count) {
    }
}
