package com.server.server.auth.dto;

import com.server.server.auth.entity.UserRole;

public record AuthResponse(
        String userId,
        String email,
        String message,
        String displayName,
        String photoUrl,
        String provider,
        UserRole role) {

    public AuthResponse(String userId, String email, String message) {
        this(userId, email, message, null, null, "LOCAL", UserRole.USER);
    }
}
