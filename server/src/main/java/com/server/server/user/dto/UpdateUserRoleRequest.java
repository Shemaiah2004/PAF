package com.server.server.user.dto;

import com.server.server.auth.entity.UserRole;
import jakarta.validation.constraints.NotNull;

public record UpdateUserRoleRequest(
        @NotNull(message = "Role is required") UserRole role) {
}
