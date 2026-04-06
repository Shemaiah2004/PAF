package com.server.server;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.server.server.auth.controller.AuthController;
import com.server.server.auth.dto.AuthResponse;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.exception.DuplicateEmailException;
import com.server.server.auth.exception.InvalidCredentialsException;
import com.server.server.auth.repository.UserRepository;
import com.server.server.auth.security.RestAccessDeniedHandler;
import com.server.server.auth.security.RestAuthenticationEntryPoint;
import com.server.server.auth.security.SessionAuthenticationService;
import com.server.server.auth.security.UserSessionRefreshFilter;
import com.server.server.auth.service.AuthService;
import com.server.server.config.SecurityConfig;
import com.server.server.user.service.UserAccessService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({
        SecurityConfig.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class,
        UserSessionRefreshFilter.class
})
class ServerApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private SessionAuthenticationService sessionAuthenticationService;

    @MockitoBean
    private UserAccessService userAccessService;

    @MockitoBean
    private UserRepository userRepository;

    @Test
    void contextLoads() {
    }

    @Test
    void authConfigReturnsGoogleConfigurationState() throws Exception {
        mockMvc.perform(get("/api/auth/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleSignInEnabled").isBoolean());
    }

    @Test
    void signupCreatesUser() throws Exception {
        given(authService.signUp(any()))
                .willReturn(new AuthResponse("507f1f77bcf86cd799439011", "test@example.com", "Account created successfully."));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "test@example.com",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.message").value("Account created successfully."))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void signupRejectsDuplicateEmail() throws Exception {
        given(authService.signUp(any()))
                .willThrow(new DuplicateEmailException("An account with this email already exists"));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "test@example.com",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An account with this email already exists"));
    }

    @Test
    void signupReturnsServiceUnavailableWhenMongoDbIsDown() throws Exception {
        given(authService.signUp(any()))
                .willThrow(new DataAccessResourceFailureException("MongoDB is unavailable"));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "test@example.com",
                                  "password": "password123"
                                }
                                """))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("MongoDB connection is unavailable. Check MONGODB_URI or MONGODB_PASSWORD."));
    }

    @Test
    void googleSigninReturnsAuthenticatedUser() throws Exception {
        given(authService.signInWithGoogle(any()))
                .willReturn(new AuthResponse(
                        "507f1f77bcf86cd799439011",
                        "google@example.com",
                        "Signed in with Google successfully.",
                        "Google User",
                        "https://example.com/photo.png",
                        "GOOGLE",
                        UserRole.USER));

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "credential": "google-id-token"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("google@example.com"))
                .andExpect(jsonPath("$.provider").value("GOOGLE"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void googleSigninRejectsInvalidCredential() throws Exception {
        given(authService.signInWithGoogle(any()))
                .willThrow(new InvalidCredentialsException("Google sign-in could not be verified."));

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "credential": "invalid-token"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Google sign-in could not be verified."));
    }
}
