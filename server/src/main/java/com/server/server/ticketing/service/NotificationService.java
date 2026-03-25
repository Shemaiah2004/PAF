package com.server.server.ticketing.service;

import com.server.server.ticketing.dto.response.NotificationResponse;
import com.server.server.ticketing.entity.Notification;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.NotificationType;
import com.server.server.ticketing.mapper.TicketingMapper;
import com.server.server.ticketing.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final CurrentUserService currentUserService;

    public NotificationService(NotificationRepository notificationRepository,
                               CurrentUserService currentUserService) {
        this.notificationRepository = notificationRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public void notifyStatusChange(Ticket ticket, String message, User actor) {
        createNotifications(ticket, NotificationType.STATUS_CHANGED, "Ticket status updated", message, actor);
    }

    @Transactional
    public void notifyCommentAdded(Ticket ticket, String message, User actor) {
        createNotifications(ticket, NotificationType.COMMENT_ADDED, "New ticket comment", message, actor);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getCurrentUserNotifications() {
        return notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(currentUserService.getCurrentUser().getId())
                .stream()
                .map(TicketingMapper::toNotificationResponse)
                .toList();
    }

    private void createNotifications(Ticket ticket,
                                     NotificationType type,
                                     String title,
                                     String message,
                                     User actor) {
        Set<User> recipients = new LinkedHashSet<>();
        recipients.add(ticket.getCreatedBy());
        if (ticket.getAssignedTechnician() != null) {
            recipients.add(ticket.getAssignedTechnician());
        }

        List<Notification> notifications = recipients.stream()
                .filter(recipient -> !recipient.getId().equals(actor.getId()))
                .map(recipient -> {
                    Notification notification = new Notification();
                    notification.setRecipient(recipient);
                    notification.setTicket(ticket);
                    notification.setType(type);
                    notification.setTitle(title);
                    notification.setMessage(message);
                    notification.setReadFlag(false);
                    return notification;
                })
                .toList();

        notificationRepository.saveAll(notifications);
    }
}
