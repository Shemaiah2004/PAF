package com.server.server.ticketing.dto.response;

import com.server.server.ticketing.enums.TicketPriority;
import com.server.server.ticketing.enums.TicketSeverity;
import com.server.server.ticketing.enums.TicketStatus;
import com.server.server.ticketing.enums.TicketType;

import java.time.LocalDateTime;
import java.util.List;

public record TicketResponse(
        Long id,
        String ticketNumber,
        String title,
        TicketType type,
        String category,
        String subcategory,
        String description,
        TicketPriority priority,
        TicketSeverity severity,
        TicketStatus status,
        String preferredContactDetails,
        String location,
        String building,
        String department,
        String resolutionNotes,
        String rejectionReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime dueAt,
        boolean archived,
        UserSummaryResponse createdBy,
        UserSummaryResponse assignedTechnician,
        List<String> attachments,
        List<CommentResponse> comments,
        List<TicketActivityResponse> activity
) {
}
