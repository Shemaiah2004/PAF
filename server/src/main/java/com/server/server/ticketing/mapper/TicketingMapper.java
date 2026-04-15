package com.server.server.ticketing.mapper;

import com.server.server.ticketing.dto.response.CommentResponse;
import com.server.server.ticketing.dto.response.NotificationResponse;
import com.server.server.ticketing.dto.response.TicketActivityResponse;
import com.server.server.ticketing.dto.response.TicketResponse;
import com.server.server.ticketing.dto.response.UserProfileResponse;
import com.server.server.ticketing.dto.response.UserSummaryResponse;
import com.server.server.ticketing.entity.Notification;
import com.server.server.ticketing.entity.TicketActivity;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketComment;
import com.server.server.ticketing.entity.User;

import java.util.List;

public final class TicketingMapper {

    private TicketingMapper() {
    }

    public static TicketResponse toTicketResponse(
            Ticket ticket,
            List<CommentResponse> comments,
            List<TicketActivityResponse> activity) {
        return new TicketResponse(
                ticket.getId(),
                ticket.getTicketNumber(),
                ticket.getTitle(),
                ticket.getType(),
                ticket.getCategory(),
                ticket.getSubcategory(),
                ticket.getDescription(),
                ticket.getPriority(),
                ticket.getSeverity(),
                ticket.getStatus(),
                ticket.getPreferredContactDetails(),
                ticket.getLocation(),
                ticket.getBuilding(),
                ticket.getDepartment(),
                ticket.getResolutionNotes(),
                ticket.getRejectionReason(),
                ticket.getCreatedAt(),
                ticket.getUpdatedAt(),
                ticket.getDueAt(),
                ticket.isArchived(),
                toUserSummary(ticket.getCreatedBy()),
                ticket.getAssignedTechnician() == null ? null : toUserSummary(ticket.getAssignedTechnician()),
                ticket.getAttachments(),
                comments,
                activity
        );
    }

    public static CommentResponse toCommentResponse(TicketComment comment, boolean editable) {
        return new CommentResponse(
                comment.getId(),
                comment.getMessage(),
                toUserSummary(comment.getAuthor()),
                comment.getTimestamp(),
                comment.isInternalNote(),
                editable
        );
    }

    public static TicketActivityResponse toActivityResponse(TicketActivity activity) {
        return new TicketActivityResponse(
                activity.getId(),
                activity.getAction(),
                activity.getMessage(),
                activity.getFromStatus(),
                activity.getToStatus(),
                activity.getPreviousAssigneeName(),
                activity.getNewAssigneeName(),
                activity.isInternalOnly(),
                toUserSummary(activity.getActor()),
                activity.getCreatedAt()
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
