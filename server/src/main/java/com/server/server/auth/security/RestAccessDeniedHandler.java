package com.server.server.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.server.server.common.ApiError;
import java.io.IOException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public RestAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getOutputStream(),
                new ApiError(resolveMessage(request)));
    }

    private String resolveMessage(HttpServletRequest request) {
        String path = request.getServletPath();

        if (path == null || path.isBlank()) {
            path = request.getRequestURI();
        }

        if (path.startsWith("/api/users")
                || ("GET".equalsIgnoreCase(request.getMethod()) && "/api/role-requests".equals(path))
                || (path.startsWith("/api/role-requests/")
                        && (path.endsWith("/approve") || path.endsWith("/reject")))) {
            return "Only admins can access this resource.";
        }

        return "You do not have permission to access this resource.";
    }
}
