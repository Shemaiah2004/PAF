package com.server.server.ticketing.dto.response;

import com.server.server.ticketing.enums.TicketPriority;
import com.server.server.ticketing.enums.TicketStatus;

import java.time.LocalDateTime;
import java.util.List;

public record TicketResponse(
        Long id,
        String title,
        String category,
        String description,
        TicketPriority priority,
        TicketStatus status,
        String preferredContactDetails,
        String resolutionNotes,
        String rejectionReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        UserSummaryResponse createdBy,
        UserSummaryResponse assignedTechnician,
        List<String> attachments,
        List<CommentResponse> comments
) {
}
