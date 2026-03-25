package com.server.server.ticketing.dto.request;

import jakarta.validation.constraints.NotNull;

public class AssignTicketRequest {

    @NotNull(message = "Technician id is required")
    private Long technicianId;

    public Long getTechnicianId() {
        return technicianId;
    }

    public void setTechnicianId(Long technicianId) {
        this.technicianId = technicianId;
    }
}
