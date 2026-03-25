package com.server.server.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record GoogleSignInRequest(
        @NotBlank(message = "Google credential is required")
        String credential) {
}
