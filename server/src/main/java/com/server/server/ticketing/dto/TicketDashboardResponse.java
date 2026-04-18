package com.server.server.ticketing.dto;

import com.server.server.ticketing.entity.Ticket;
import java.util.List;

public record TicketDashboardResponse(
        Cards cards,
        List<SlaBucket> slaBuckets,
        Charts charts,
        List<Ticket> recentTickets) {

    public record Cards(
            long totalTickets,
            long openTickets,
            long overdueTickets,
            long resolvedRate) {
    }

    public record SlaBucket(
            String label,
            long value,
            String description) {
    }

    public record Charts(
            List<CountBucket> statusBreakdown,
            List<CountBucket> priorityBreakdown,
            List<CountBucket> typeBreakdown,
            List<MonthlyTrendPoint> monthlyTrend) {
    }

    public record CountBucket(
            String _id,
            long count) {
    }

    public record MonthlyTrendPoint(
            String label,
            long created) {
    }
}
