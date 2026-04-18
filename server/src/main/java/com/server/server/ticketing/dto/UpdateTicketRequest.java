package com.server.server.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.server.server.ticketing.entity.TicketPriority;
import com.server.server.ticketing.entity.TicketStatus;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UpdateTicketRequest(
        TicketStatus status,
        TicketPriority priority,
        String category,
        String description,
        CreateTicketRequest.TicketLocationRequest location,
        Boolean requiresExtendedResolution,
        String assignedTechnicianId) {
}
