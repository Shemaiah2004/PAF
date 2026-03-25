package com.server.server.auth.google;

public record GoogleUserProfile(
        String subject,
        String email,
        boolean emailVerified,
        String displayName,
        String pictureUrl,
        String hostedDomain) {
}
