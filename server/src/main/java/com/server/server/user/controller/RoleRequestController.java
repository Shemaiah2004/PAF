package com.server.server.user.controller;

import com.server.server.user.dto.CreateRoleRequestRequest;
import com.server.server.user.dto.RoleRequestDeleteResponse;
import com.server.server.user.dto.RoleRequestItemResponse;
import com.server.server.user.dto.RoleRequestMutationResponse;
import com.server.server.user.dto.UpdateRoleRequestRequest;
import com.server.server.user.service.RoleRequestService;
import com.server.server.user.service.UserAccessService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/role-requests")
public class RoleRequestController {

    private final UserAccessService userAccessService;
    private final RoleRequestService roleRequestService;

    public RoleRequestController(
            UserAccessService userAccessService,
            RoleRequestService roleRequestService) {
        this.userAccessService = userAccessService;
        this.roleRequestService = roleRequestService;
    }

    @GetMapping("/my")
    public ResponseEntity<List<RoleRequestItemResponse>> getMyRoleRequests(
            @RequestHeader(value = "X-Auth-User-Id", required = false) String userId) {
        userAccessService.getAuthenticatedUser(userId);
        return ResponseEntity.ok(roleRequestService.getMyRoleRequests(userId));
    }

    @PostMapping
    public ResponseEntity<RoleRequestMutationResponse> createRoleRequest(
            @RequestHeader(value = "X-Auth-User-Id", required = false) String userId,
            @Valid @RequestBody CreateRoleRequestRequest request) {
        userAccessService.getAuthenticatedUser(userId);

        RoleRequestMutationResponse response = roleRequestService.createRoleRequest(
                userId,
                request.requestedRole(),
                request.description());

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<RoleRequestItemResponse>> getAllRoleRequests(
            @RequestHeader(value = "X-Auth-User-Id", required = false) String userId) {
        userAccessService.assertAdminAccess(userId);
        return ResponseEntity.ok(roleRequestService.getAllRoleRequests());
    }

    @PatchMapping("/{requestId}/approve")
    public ResponseEntity<RoleRequestMutationResponse> approveRoleRequest(
            @RequestHeader(value = "X-Auth-User-Id", required = false) String userId,
            @PathVariable String requestId) {
        userAccessService.assertAdminAccess(userId);
        return ResponseEntity.ok(roleRequestService.approveRoleRequest(userId, requestId));
    }

    @PatchMapping("/{requestId}")
    public ResponseEntity<RoleRequestMutationResponse> updateRoleRequest(
            @RequestHeader(value = "X-Auth-User-Id", required = false) String userId,
            @PathVariable String requestId,
            @Valid @RequestBody UpdateRoleRequestRequest request) {
        userAccessService.getAuthenticatedUser(userId);

        return ResponseEntity.ok(roleRequestService.updateRoleRequest(
                userId,
                requestId,
                request.requestedRole(),
                request.description()));
    }

    @DeleteMapping("/{requestId}")
    public ResponseEntity<RoleRequestDeleteResponse> deleteRoleRequest(
            @RequestHeader(value = "X-Auth-User-Id", required = false) String userId,
            @PathVariable String requestId) {
        userAccessService.getAuthenticatedUser(userId);
        return ResponseEntity.ok(roleRequestService.deleteRoleRequest(userId, requestId));
    }
}
