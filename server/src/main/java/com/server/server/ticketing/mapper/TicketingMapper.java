package com.server.server.ticketing.mapper;

import com.server.server.ticketing.dto.response.CommentResponse;
import com.server.server.ticketing.dto.response.NotificationResponse;
import com.server.server.ticketing.dto.response.TicketResponse;
import com.server.server.ticketing.dto.response.UserProfileResponse;
import com.server.server.ticketing.dto.response.UserSummaryResponse;
import com.server.server.ticketing.entity.Notification;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketComment;
import com.server.server.ticketing.entity.User;

import java.util.List;

public final class TicketingMapper {

    private TicketingMapper() {
    }

    public static TicketResponse toTicketResponse(Ticket ticket, List<CommentResponse> comments) {
        return new TicketResponse(
                ticket.getId(),
                ticket.getTitle(),
                ticket.getCategory(),
                ticket.getDescription(),
                ticket.getPriority(),
                ticket.getStatus(),
                ticket.getPreferredContactDetails(),
                ticket.getResolutionNotes(),
                ticket.getRejectionReason(),
                ticket.getCreatedAt(),
                ticket.getUpdatedAt(),
                toUserSummary(ticket.getCreatedBy()),
                ticket.getAssignedTechnician() == null ? null : toUserSummary(ticket.getAssignedTechnician()),
                ticket.getAttachments(),
                comments
        );
    }

    public static CommentResponse toCommentResponse(TicketComment comment, boolean editable) {
        return new CommentResponse(
                comment.getId(),
                comment.getMessage(),
                toUserSummary(comment.getAuthor()),
                comment.getTimestamp(),
                editable
        );
    }

    public static NotificationResponse toNotificationResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.isReadFlag(),
                notification.getTicket().getId(),
                notification.getCreatedAt()
        );
    }

    public static UserSummaryResponse toUserSummary(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole()
        );
    }

    public static UserProfileResponse toUserProfile(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole()
        );
    }
}
