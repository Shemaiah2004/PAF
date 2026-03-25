package com.server.server.common;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(
        boolean success,
        String message,
        Map<String, String> errors,
        Instant timestamp
) {
    public static ApiErrorResponse of(String message, Map<String, String> errors) {
        return new ApiErrorResponse(false, message, errors, Instant.now());
    }
}
