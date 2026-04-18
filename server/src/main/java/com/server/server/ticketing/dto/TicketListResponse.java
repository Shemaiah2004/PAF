package com.server.server.ticketing.dto;

import com.server.server.ticketing.entity.Ticket;
import java.util.List;

public record TicketListResponse(
        List<Ticket> items,
        Pagination pagination) {

    public record Pagination(long total) {
    }
}
