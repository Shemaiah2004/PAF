package com.server.server.user.controller;

import com.server.server.user.dto.CreateRoleRequestRequest;
import com.server.server.user.dto.RejectRoleRequestRequest;
import com.server.server.user.dto.RoleRequestDeleteResponse;
import com.server.server.user.dto.RoleRequestItemResponse;
import com.server.server.user.dto.RoleRequestMutationResponse;
import com.server.server.user.dto.UpdateRoleRequestRequest;
import com.server.server.user.service.RoleRequestService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/role-requests")
public class RoleRequestController {

    private final RoleRequestService roleRequestService;

    public RoleRequestController(RoleRequestService roleRequestService) {
        this.roleRequestService = roleRequestService;
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/my")
    public ResponseEntity<List<RoleRequestItemResponse>> getMyRoleRequests(Authentication authentication) {
        String userId = authentication.getName();
        return ResponseEntity.ok(roleRequestService.getMyRoleRequests(userId));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public ResponseEntity<RoleRequestMutationResponse> createRoleRequest(
            Authentication authentication,
            @Valid @RequestBody CreateRoleRequestRequest request) {
        String userId = authentication.getName();

        RoleRequestMutationResponse response = roleRequestService.createRoleRequest(
                userId,
                request.requestedRole(),
                request.description());

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<RoleRequestItemResponse>> getAllRoleRequests() {
        return ResponseEntity.ok(roleRequestService.getAllRoleRequests());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{requestId}/approve")
    public ResponseEntity<RoleRequestMutationResponse> approveRoleRequest(
            Authentication authentication,
            @PathVariable String requestId) {
        String userId = authentication.getName();
        return ResponseEntity.ok(roleRequestService.approveRoleRequest(userId, requestId));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{requestId}/reject")
    public ResponseEntity<RoleRequestMutationResponse> rejectRoleRequest(
            Authentication authentication,
            @PathVariable String requestId,
            @Valid @RequestBody RejectRoleRequestRequest request) {
        String userId = authentication.getName();
        return ResponseEntity.ok(roleRequestService.rejectRoleRequest(
                userId,
                requestId,
                request.rejectionReason()));
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/{requestId}")
    public ResponseEntity<RoleRequestMutationResponse> updateRoleRequest(
            Authentication authentication,
            @PathVariable String requestId,
            @Valid @RequestBody UpdateRoleRequestRequest request) {
        String userId = authentication.getName();

        return ResponseEntity.ok(roleRequestService.updateRoleRequest(
                userId,
                requestId,
                request.requestedRole(),
                request.description()));
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{requestId}")
    public ResponseEntity<RoleRequestDeleteResponse> deleteRoleRequest(
            Authentication authentication,
            @PathVariable String requestId) {
        String userId = authentication.getName();
        return ResponseEntity.ok(roleRequestService.deleteRoleRequest(userId, requestId));
    }
}
