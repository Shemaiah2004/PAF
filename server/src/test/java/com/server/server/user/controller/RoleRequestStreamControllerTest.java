package com.server.server.user.controller;

import static com.server.server.support.TestAuthentication.authenticatedUser;
import static com.server.server.support.TestAuthentication.user;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.auth.security.RestAccessDeniedHandler;
import com.server.server.auth.security.RestAuthenticationEntryPoint;
import com.server.server.auth.security.UserSessionRefreshFilter;
import com.server.server.config.SecurityConfig;
import com.server.server.user.service.RoleRequestRealtimeService;
import com.server.server.user.service.UserAccessService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@WebMvcTest(RoleRequestStreamController.class)
@Import({
        SecurityConfig.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class,
        UserSessionRefreshFilter.class
})
class RoleRequestStreamControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserAccessService userAccessService;

    @MockitoBean
    private RoleRequestRealtimeService roleRequestRealtimeService;

    @Test
    void streamRoleRequestsSubscribesAdminsToAdminEvents() throws Exception {
        User adminUser = new User();
        adminUser.setId("admin-user");
        adminUser.setRole(UserRole.ADMIN);

        given(userRepository.findById("admin-user")).willReturn(Optional.of(user("admin-user", UserRole.ADMIN)));
        given(userAccessService.getAuthenticatedUser("admin-user")).willReturn(adminUser);
        given(roleRequestRealtimeService.subscribe("admin-user", true)).willReturn(new SseEmitter());

        mockMvc.perform(get("/api/role-requests/stream")
                        .with(authenticatedUser("admin-user", UserRole.ADMIN))
                        .param("adminEvents", "true"))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted());

        verify(roleRequestRealtimeService).subscribe("admin-user", true);
    }

    @Test
    void streamRoleRequestsIgnoresAdminEventsForNonAdmins() throws Exception {
        User signedInUser = new User();
        signedInUser.setId("user-1");
        signedInUser.setRole(UserRole.USER);

        given(userRepository.findById("user-1")).willReturn(Optional.of(user("user-1", UserRole.USER)));
        given(userAccessService.getAuthenticatedUser("user-1")).willReturn(signedInUser);
        given(roleRequestRealtimeService.subscribe("user-1", false)).willReturn(new SseEmitter());

        mockMvc.perform(get("/api/role-requests/stream")
                        .with(authenticatedUser("user-1", UserRole.USER))
                        .param("adminEvents", "true"))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted());

        verify(roleRequestRealtimeService).subscribe("user-1", false);
    }
}
