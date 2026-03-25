package com.server.server.user.dto;

import com.server.server.auth.entity.UserRole;
import java.time.LocalDateTime;

public record UserTableItemResponse(
        String id,
        String email,
        String displayName,
        String photoUrl,
        String provider,
        UserRole role,
        LocalDateTime createdAt) {
}
