package com.server.server.user.controller;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.user.service.RoleRequestRealtimeService;
import com.server.server.user.service.UserAccessService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/role-requests")
public class RoleRequestStreamController {

    private final UserAccessService userAccessService;
    private final RoleRequestRealtimeService roleRequestRealtimeService;

    public RoleRequestStreamController(
            UserAccessService userAccessService,
            RoleRequestRealtimeService roleRequestRealtimeService) {
        this.userAccessService = userAccessService;
        this.roleRequestRealtimeService = roleRequestRealtimeService;
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamRoleRequests(
            Authentication authentication,
            @RequestParam(defaultValue = "false") boolean adminEvents) {
        User user = userAccessService.getAuthenticatedUser(authentication.getName());
        boolean subscribeToAdminEvents = adminEvents && getUserRole(user) == UserRole.ADMIN;
        return roleRequestRealtimeService.subscribe(user.getId(), subscribeToAdminEvents);
    }

    private UserRole getUserRole(User user) {
        return user.getRole() != null ? user.getRole() : UserRole.USER;
    }
}
