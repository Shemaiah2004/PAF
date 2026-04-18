package com.server.server.ticketing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AssignTechnicianRequest(String technicianId) {
}
