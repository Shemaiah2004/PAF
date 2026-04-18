package com.server.server.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.server.server.ticketing.entity.TicketPriority;
import com.server.server.ticketing.entity.TicketType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CreateTicketRequest(
        @NotBlank(message = "Ticket title is required.") String title,
        @NotBlank(message = "Description is required.") String description,
        @NotNull(message = "Ticket type is required.") TicketType type,
        @NotNull(message = "Please select a priority.") TicketPriority priority,
        @NotBlank(message = "Please select a category.") String category,
        Boolean requiresExtendedResolution,
        @Valid @NotNull(message = "Location is required.") TicketLocationRequest location) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TicketLocationRequest(
            @NotBlank(message = "Building or main area is required.") String building,
            String floor,
            String room,
            String campus,
            String note) {
    }
}
