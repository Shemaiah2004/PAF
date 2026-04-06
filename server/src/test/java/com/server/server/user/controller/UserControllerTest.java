package com.server.server.user.controller;

import static com.server.server.support.TestAuthentication.authenticatedUser;
import static com.server.server.support.TestAuthentication.user;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.auth.security.RestAccessDeniedHandler;
import com.server.server.auth.security.RestAuthenticationEntryPoint;
import com.server.server.auth.security.UserSessionRefreshFilter;
import com.server.server.config.SecurityConfig;
import com.server.server.user.dto.UserRoleUpdateResponse;
import com.server.server.user.dto.UserTableItemResponse;
import com.server.server.user.exception.UserNotFoundException;
import com.server.server.user.service.UserManagementService;
import com.server.server.user.service.UserQueryService;
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

@WebMvcTest(UserController.class)
@Import({
        SecurityConfig.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class,
        UserSessionRefreshFilter.class
})
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserManagementService userManagementService;

    @MockitoBean
    private UserQueryService userQueryService;

    @Test
    void getUsersRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("You must be signed in to access this resource."));
    }

    @Test
    void getUsersReturnsDisplayNameFallbackAndAdminRole() throws Exception {
        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
        given(userQueryService.getUsersForTable(null, null, null)).willReturn(List.of(
                new UserTableItemResponse(
                        "user-1",
                        "hettiarachchianuk01@gmail.com",
                        "hettiarachchianuk01@gmail.com",
                        "https://example.com/photo.png",
                        "GOOGLE",
                        UserRole.USER,
                        LocalDateTime.of(2026, 3, 21, 9, 47, 12)),
                new UserTableItemResponse(
                        "user-2",
                        "admin@example.com",
                        "Admin User",
                        null,
                        "LOCAL",
                        UserRole.ADMIN,
                        LocalDateTime.of(2026, 3, 21, 10, 26, 59))));

        mockMvc.perform(get("/api/users").with(authenticatedUser("admin-user", UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].displayName").value("hettiarachchianuk01@gmail.com"))
                .andExpect(jsonPath("$[0].role").value("USER"))
                .andExpect(jsonPath("$[1].role").value("ADMIN"));
    }

    @Test
    void getUsersSupportsSearchFilters() throws Exception {
        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
        given(userQueryService.getUsersForTable("Admin", "admin@example.com", UserRole.ADMIN)).willReturn(List.of(
                new UserTableItemResponse(
                        "user-2",
                        "admin@example.com",
                        "Admin User",
                        null,
                        "LOCAL",
                        UserRole.ADMIN,
                        LocalDateTime.of(2026, 3, 21, 10, 26, 59))));

        mockMvc.perform(get("/api/users")
                        .with(authenticatedUser("admin-user", UserRole.ADMIN))
                        .param("displayName", "Admin")
                        .param("email", "admin@example.com")
                        .param("role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].displayName").value("Admin User"))
                .andExpect(jsonPath("$[0].role").value("ADMIN"));
    }

    @Test
    void getUsersRejectsNonAdminAccess() throws Exception {
        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));

        mockMvc.perform(get("/api/users").with(authenticatedUser("user-1", UserRole.USER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only admins can access this resource."));
    }

    @Test
    void updateUserRoleReturnsUpdatedRole() throws Exception {
        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
        given(userManagementService.updateUserRole("user-2", UserRole.MANAGER)).willReturn(
                new UserRoleUpdateResponse(
                        "User role updated to MANAGER successfully.",
                        new UserTableItemResponse(
                                "user-2",
                                "manager@example.com",
                                "Manager User",
                                null,
                                "LOCAL",
                                UserRole.MANAGER,
                                LocalDateTime.of(2026, 3, 21, 10, 26, 59))));

        mockMvc.perform(patch("/api/users/user-2/role")
                        .with(authenticatedUser("admin-user", UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role": "MANAGER"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User role updated to MANAGER successfully."))
                .andExpect(jsonPath("$.user.email").value("manager@example.com"))
                .andExpect(jsonPath("$.user.role").value("MANAGER"));
    }

    @Test
    void updateUserRoleReturnsNotFoundForMissingUser() throws Exception {
        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
        given(userManagementService.updateUserRole("missing-user", UserRole.TECHNICIAN))
                .willThrow(new UserNotFoundException("User not found."));

        mockMvc.perform(patch("/api/users/missing-user/role")
                        .with(authenticatedUser("admin-user", UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role": "TECHNICIAN"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found."));
    }
}
