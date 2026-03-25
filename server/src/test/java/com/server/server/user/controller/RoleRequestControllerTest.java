package com.server.server.user.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.server.server.auth.entity.UserRole;
import com.server.server.auth.exception.ForbiddenAccessException;
import com.server.server.user.dto.RoleRequestItemResponse;
import com.server.server.user.dto.RoleRequestDeleteResponse;
import com.server.server.user.dto.RoleRequestMutationResponse;
import com.server.server.user.dto.UserTableItemResponse;
import com.server.server.user.entity.RoleRequestStatus;
import com.server.server.user.service.RoleRequestService;
import com.server.server.user.service.UserAccessService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(RoleRequestController.class)
class RoleRequestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserAccessService userAccessService;

    @MockitoBean
    private RoleRequestService roleRequestService;

    @Test
    void getMyRoleRequestsReturnsRequesterItems() throws Exception {
        given(roleRequestService.getMyRoleRequests("user-1")).willReturn(List.of(
                new RoleRequestItemResponse(
                        "request-1",
                        "user-1",
                        "user@example.com",
                        "User One",
                        UserRole.USER,
                        UserRole.MANAGER,
                        "Need manager access.",
                        RoleRequestStatus.PENDING,
                        LocalDateTime.of(2026, 3, 21, 14, 15, 0),
                        LocalDateTime.of(2026, 3, 21, 14, 15, 0),
                        null)));

        mockMvc.perform(get("/api/role-requests/my").header("X-Auth-User-Id", "user-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].requesterEmail").value("user@example.com"))
                .andExpect(jsonPath("$[0].requestedRole").value("MANAGER"))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }

    @Test
    void createRoleRequestReturnsCreatedResponse() throws Exception {
        given(roleRequestService.createRoleRequest("user-1", UserRole.ADMIN, "Need admin access.")).willReturn(
                new RoleRequestMutationResponse(
                        "Role request submitted successfully. An admin can review it now.",
                        new RoleRequestItemResponse(
                                "request-1",
                                "user-1",
                                "user@example.com",
                                "User One",
                                UserRole.USER,
                                UserRole.ADMIN,
                                "Need admin access.",
                                RoleRequestStatus.PENDING,
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                null),
                        null));

        mockMvc.perform(post("/api/role-requests")
                        .header("X-Auth-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestedRole": "ADMIN",
                                  "description": "Need admin access."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Role request submitted successfully. An admin can review it now."))
                .andExpect(jsonPath("$.request.id").value("request-1"))
                .andExpect(jsonPath("$.request.requestedRole").value("ADMIN"));
    }

    @Test
    void getAllRoleRequestsRejectsNonAdminAccess() throws Exception {
        willThrow(new ForbiddenAccessException("Only admins can access this resource."))
                .given(userAccessService)
                .assertAdminAccess("user-1");

        mockMvc.perform(get("/api/role-requests").header("X-Auth-User-Id", "user-1"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only admins can access this resource."));
    }

    @Test
    void approveRoleRequestReturnsUpdatedUserRole() throws Exception {
        given(roleRequestService.approveRoleRequest("admin-user", "request-1")).willReturn(
                new RoleRequestMutationResponse(
                        "Role request approved and user role updated to MANAGER.",
                        new RoleRequestItemResponse(
                                "request-1",
                                "user-1",
                                "user@example.com",
                                "User One",
                                UserRole.USER,
                                UserRole.MANAGER,
                                "Need manager access.",
                                RoleRequestStatus.APPROVED,
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 20, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 20, 0)),
                        new UserTableItemResponse(
                                "user-1",
                                "user@example.com",
                                "User One",
                                null,
                                "LOCAL",
                                UserRole.MANAGER,
                                LocalDateTime.of(2026, 3, 21, 9, 0, 0))));

        mockMvc.perform(patch("/api/role-requests/request-1/approve")
                        .header("X-Auth-User-Id", "admin-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Role request approved and user role updated to MANAGER."))
                .andExpect(jsonPath("$.request.status").value("APPROVED"))
                .andExpect(jsonPath("$.user.role").value("MANAGER"));
    }

    @Test
    void updateRoleRequestReturnsUpdatedRequest() throws Exception {
        given(roleRequestService.updateRoleRequest("user-1", "request-1", UserRole.ADMIN, "Updated reason.")).willReturn(
                new RoleRequestMutationResponse(
                        "Role request updated successfully.",
                        new RoleRequestItemResponse(
                                "request-1",
                                "user-1",
                                "user@example.com",
                                "User One",
                                UserRole.USER,
                                UserRole.ADMIN,
                                "Updated reason.",
                                RoleRequestStatus.PENDING,
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 25, 0),
                                null),
                        null));

        mockMvc.perform(patch("/api/role-requests/request-1")
                        .header("X-Auth-User-Id", "user-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestedRole": "ADMIN",
                                  "description": "Updated reason."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Role request updated successfully."))
                .andExpect(jsonPath("$.request.requestedRole").value("ADMIN"))
                .andExpect(jsonPath("$.request.description").value("Updated reason."));
    }

    @Test
    void deleteRoleRequestReturnsDeletedRequestId() throws Exception {
        given(roleRequestService.deleteRoleRequest("admin-user", "request-1")).willReturn(
                new RoleRequestDeleteResponse(
                        "Role request deleted successfully.",
                        "request-1"));

        mockMvc.perform(delete("/api/role-requests/request-1")
                        .header("X-Auth-User-Id", "admin-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Role request deleted successfully."))
                .andExpect(jsonPath("$.requestId").value("request-1"));
    }
}
