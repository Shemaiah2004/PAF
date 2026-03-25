package com.server.server.user.dto;

import com.server.server.auth.entity.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateRoleRequestRequest(
        @NotNull(message = "Requested role is required") UserRole requestedRole,
        @NotBlank(message = "Description is required")
        @Size(max = 500, message = "Description must be 500 characters or fewer")
        String description) {
}
