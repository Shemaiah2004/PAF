package com.server.server.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AddTicketCommentRequest(
        @NotBlank(message = "Comment message is required.") String message) {
}
