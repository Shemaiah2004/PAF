package com.server.server.user.dto;

import com.server.server.auth.entity.UserRole;
import com.server.server.user.entity.RoleRequestStatus;
import java.time.LocalDateTime;

public record RoleRequestItemResponse(
        String id,
        String requesterUserId,
        String requesterEmail,
        String requesterDisplayName,
        UserRole currentRole,
        UserRole requestedRole,
        String description,
        RoleRequestStatus status,
        String rejectionReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime reviewedAt) {
}
