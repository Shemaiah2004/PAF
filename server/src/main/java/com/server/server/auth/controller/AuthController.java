package com.server.server.auth.controller;

import com.server.server.auth.dto.AuthResponse;
import com.server.server.auth.dto.AuthConfigResponse;
import com.server.server.auth.dto.AuthResponses;
import com.server.server.auth.dto.GoogleSignInRequest;
import com.server.server.auth.dto.SignInRequest;
import com.server.server.auth.dto.SignUpRequest;
import com.server.server.auth.security.SessionAuthenticationService;
import com.server.server.auth.service.AuthService;
import com.server.server.common.ApiError;
import com.server.server.user.service.UserAccessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final SessionAuthenticationService sessionAuthenticationService;
    private final UserAccessService userAccessService;
    private final String googleClientId;

    public AuthController(
            AuthService authService,
            SessionAuthenticationService sessionAuthenticationService,
            UserAccessService userAccessService,
            @Value("${auth.google.client-id:}") String googleClientId) {
        this.authService = authService;
        this.sessionAuthenticationService = sessionAuthenticationService;
        this.userAccessService = userAccessService;
        this.googleClientId = googleClientId == null ? "" : googleClientId.trim();
    }

    @GetMapping("/config")
    public ResponseEntity<AuthConfigResponse> getAuthConfig() {
        boolean googleSignInEnabled =
                !googleClientId.isBlank() && !googleClientId.startsWith("replace-with-");

        return ResponseEntity.ok(new AuthConfigResponse(
                googleSignInEnabled,
                googleSignInEnabled ? googleClientId : null));
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signUp(@Valid @RequestBody SignUpRequest request) {
        AuthResponse response = authService.signUp(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/signin")
    public ResponseEntity<AuthResponse> signIn(
            @Valid @RequestBody SignInRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthResponse authResponse = authService.signIn(request);
        sessionAuthenticationService.signIn(authResponse, httpRequest, httpResponse);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> signInWithGoogle(
            @Valid @RequestBody GoogleSignInRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthResponse authResponse = authService.signInWithGoogle(request);
        sessionAuthenticationService.signIn(authResponse, httpRequest, httpResponse);
        return ResponseEntity.ok(authResponse);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(AuthResponses.fromUser(
                userAccessService.getAuthenticatedUser(authentication.getName()),
                "Authenticated session restored."));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/signout")
    public ResponseEntity<ApiError> signOut(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        sessionAuthenticationService.signOut(httpRequest, httpResponse);
        return ResponseEntity.ok(new ApiError("Signed out successfully."));
    }
}
