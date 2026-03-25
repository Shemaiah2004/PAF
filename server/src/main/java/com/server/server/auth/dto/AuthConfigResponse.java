package com.server.server.auth.dto;

public record AuthConfigResponse(boolean googleSignInEnabled, String googleClientId) {
}
