package com.server.server.ticketing.controller;

import com.server.server.common.ApiResponse;
import com.server.server.ticketing.dto.response.NotificationResponse;
import com.server.server.ticketing.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getNotifications() {
        return ResponseEntity.ok(ApiResponse.success(
                "Notifications fetched successfully",
                notificationService.getCurrentUserNotifications()
        ));
    }
}
