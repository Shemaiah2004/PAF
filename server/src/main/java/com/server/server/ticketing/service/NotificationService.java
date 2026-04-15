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
    public void notifyTicketCreated(Ticket ticket, String message, List<User> recipients) {
        createNotifications(ticket, NotificationType.TICKET_CREATED, "New ticket created", message, recipients, null);
    }

    @Transactional
    public void notifyTicketAssigned(Ticket ticket, String message, User actor) {
        createNotifications(ticket, NotificationType.TICKET_ASSIGNED, "Ticket assigned", message, List.of(ticket.getAssignedTechnician()), actor);
    }

    @Transactional
    public void notifyStatusChange(Ticket ticket, String message, User actor) {
        NotificationType type = NotificationType.STATUS_CHANGED;
        String title = "Ticket status updated";

        if (ticket.getStatus() != null) {
            switch (ticket.getStatus()) {
                case RESOLVED -> {
                    type = NotificationType.TICKET_RESOLVED;
                    title = "Ticket resolved";
                }
                case CLOSED -> {
                    type = NotificationType.TICKET_CLOSED;
                    title = "Ticket closed";
                }
                default -> {
                }
            }
        }

        createNotifications(ticket, type, title, message, getDefaultRecipients(ticket), actor);
    }

    @Transactional
    public void notifyCommentAdded(Ticket ticket, String message, User actor) {
        createNotifications(ticket, NotificationType.COMMENT_ADDED, "New ticket comment", message, getDefaultRecipients(ticket), actor);
    }

    @Transactional
    public void notifyOverdue(Ticket ticket, String message, List<User> recipients) {
        createNotifications(ticket, NotificationType.OVERDUE_ALERT, "Ticket overdue", message, recipients, null);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getCurrentUserNotifications() {
        return notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(currentUserService.getCurrentUser().getId())
                .stream()
                .map(TicketingMapper::toNotificationResponse)
                .toList();
    }

    private List<User> getDefaultRecipients(Ticket ticket) {
        Set<User> recipients = new LinkedHashSet<>();
        recipients.add(ticket.getCreatedBy());
        if (ticket.getAssignedTechnician() != null) {
            recipients.add(ticket.getAssignedTechnician());
        }
        return recipients.stream().toList();
    }

    private void createNotifications(Ticket ticket,
                                     NotificationType type,
                                     String title,
                                     String message,
                                     List<User> recipients,
                                     User actor) {
        List<Notification> notifications = recipients.stream()
                .filter(recipient -> recipient != null)
                .filter(recipient -> actor == null || !recipient.getId().equals(actor.getId()))
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

        if (!notifications.isEmpty()) {
            notificationRepository.saveAll(notifications);
        }
    }
}
