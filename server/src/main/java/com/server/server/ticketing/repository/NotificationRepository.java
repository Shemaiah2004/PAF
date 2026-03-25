package com.server.server.ticketing.repository;

import com.server.server.ticketing.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findAllByRecipientIdOrderByCreatedAtDesc(Long recipientId);
}
