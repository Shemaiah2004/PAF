package com.server.server.user.controller;

import com.server.server.user.dto.UpdateUserRoleRequest;
import com.server.server.user.dto.UserRoleUpdateResponse;
import com.server.server.user.dto.UserTableItemResponse;
import com.server.server.auth.entity.UserRole;
import com.server.server.user.service.UserManagementService;
import com.server.server.user.service.UserQueryService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserManagementService userManagementService;
    private final UserQueryService userQueryService;

    public UserController(
            UserManagementService userManagementService,
            UserQueryService userQueryService) {
        this.userManagementService = userManagementService;
        this.userQueryService = userQueryService;
    }

    @GetMapping
    public ResponseEntity<List<UserTableItemResponse>> getUsers(
            @RequestParam(required = false) String displayName,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) UserRole role) {
        return ResponseEntity.ok(userQueryService.getUsersForTable(displayName, email, role));
    }

    @PatchMapping("/{targetUserId}/role")
    public ResponseEntity<UserRoleUpdateResponse> updateUserRole(
            @PathVariable String targetUserId,
            @Valid @RequestBody UpdateUserRoleRequest request) {
        return ResponseEntity.ok(userManagementService.updateUserRole(targetUserId, request.role()));
    }
}
