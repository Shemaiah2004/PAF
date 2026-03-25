package com.server.server.ticketing.dto.response;

import com.server.server.ticketing.enums.Role;

public record UserSummaryResponse(
        Long id,
        String fullName,
        String email,
        Role role
) {
}
