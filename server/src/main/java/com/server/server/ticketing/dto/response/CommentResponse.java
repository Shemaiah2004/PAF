package com.server.server.ticketing.dto.response;

import java.time.LocalDateTime;

public record CommentResponse(
        Long id,
        String message,
        UserSummaryResponse author,
        LocalDateTime timestamp,
        boolean editable
) {
}
