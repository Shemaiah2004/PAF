package com.server.server.ticketing.dto.response;

import com.server.server.ticketing.enums.Role;

public record UserProfileResponse(
        Long id,
        String fullName,
        String email,
        Role role
) {
}
