package com.server.server.user.controller;

import static com.server.server.support.TestAuthentication.authenticatedUser;
import static com.server.server.support.TestAuthentication.user;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.auth.security.RestAccessDeniedHandler;
import com.server.server.auth.security.RestAuthenticationEntryPoint;
import com.server.server.auth.security.UserSessionRefreshFilter;
import com.server.server.config.SecurityConfig;
import com.server.server.user.dto.RoleRequestDeleteResponse;
import com.server.server.user.dto.RoleRequestItemResponse;
import com.server.server.user.dto.RoleRequestMutationResponse;
import com.server.server.user.dto.UserTableItemResponse;
import com.server.server.user.entity.RoleRequestStatus;
import com.server.server.user.service.RoleRequestService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(RoleRequestController.class)
@Import({
        SecurityConfig.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class,
        UserSessionRefreshFilter.class
})
class RoleRequestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private RoleRequestService roleRequestService;

    @Test
    void getMyRoleRequestsRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/role-requests/my"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("You must be signed in to access this resource."));
    }

    @Test
    void getMyRoleRequestsReturnsRequesterItems() throws Exception {
        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));
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
                        null,
                        LocalDateTime.of(2026, 3, 21, 14, 15, 0),
                        LocalDateTime.of(2026, 3, 21, 14, 15, 0),
                        null)));

        mockMvc.perform(get("/api/role-requests/my").with(authenticatedUser("user-1", UserRole.USER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].requesterEmail").value("user@example.com"))
                .andExpect(jsonPath("$[0].requestedRole").value("MANAGER"))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }

    @Test
    void createRoleRequestReturnsCreatedResponse() throws Exception {
        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));
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
                                null,
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                null),
                        null));

        mockMvc.perform(post("/api/role-requests")
                        .with(authenticatedUser("user-1", UserRole.USER))
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
        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));

        mockMvc.perform(get("/api/role-requests").with(authenticatedUser("user-1", UserRole.USER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only admins can access this resource."));
    }

    @Test
    void approveRoleRequestReturnsUpdatedUserRole() throws Exception {
        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
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
                                null,
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
                        .with(authenticatedUser("admin-user", UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Role request approved and user role updated to MANAGER."))
                .andExpect(jsonPath("$.request.status").value("APPROVED"))
                .andExpect(jsonPath("$.user.role").value("MANAGER"));
    }

    @Test
    void rejectRoleRequestReturnsUpdatedRequestWithReason() throws Exception {
        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
        given(roleRequestService.rejectRoleRequest("admin-user", "request-1", "Please add more project details.")).willReturn(
                new RoleRequestMutationResponse(
                        "Role request rejected and feedback sent to the requester.",
                        new RoleRequestItemResponse(
                                "request-1",
                                "user-1",
                                "user@example.com",
                                "User One",
                                UserRole.USER,
                                UserRole.ADMIN,
                                "Need admin access.",
                                RoleRequestStatus.REJECTED,
                                "Please add more project details.",
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 22, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 22, 0)),
                        null));

        mockMvc.perform(patch("/api/role-requests/request-1/reject")
                        .with(authenticatedUser("admin-user", UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "rejectionReason": "Please add more project details."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Role request rejected and feedback sent to the requester."))
                .andExpect(jsonPath("$.request.status").value("REJECTED"))
                .andExpect(jsonPath("$.request.rejectionReason").value("Please add more project details."));
    }

    @Test
    void updateRoleRequestReturnsUpdatedRequest() throws Exception {
        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));
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
                                null,
                                LocalDateTime.of(2026, 3, 21, 15, 5, 0),
                                LocalDateTime.of(2026, 3, 21, 15, 25, 0),
                                null),
                        null));

        mockMvc.perform(patch("/api/role-requests/request-1")
                        .with(authenticatedUser("user-1", UserRole.USER))
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
        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));
        given(roleRequestService.deleteRoleRequest("user-1", "request-1")).willReturn(
                new RoleRequestDeleteResponse(
                        "Role request deleted successfully.",
                        "request-1"));

        mockMvc.perform(delete("/api/role-requests/request-1")
                        .with(authenticatedUser("user-1", UserRole.USER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Role request deleted successfully."))
                .andExpect(jsonPath("$.requestId").value("request-1"));
    }
}
