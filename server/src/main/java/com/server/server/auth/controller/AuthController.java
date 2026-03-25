package com.server.server.auth.controller;

import com.server.server.auth.dto.AuthResponse;
import com.server.server.auth.dto.AuthConfigResponse;
import com.server.server.auth.dto.GoogleSignInRequest;
import com.server.server.auth.dto.SignInRequest;
import com.server.server.auth.dto.SignUpRequest;
import com.server.server.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final String googleClientId;

    public AuthController(
            AuthService authService,
            @Value("${auth.google.client-id:}") String googleClientId) {
        this.authService = authService;
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
    public ResponseEntity<AuthResponse> signIn(@Valid @RequestBody SignInRequest request) {
        AuthResponse response = authService.signIn(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> signInWithGoogle(@Valid @RequestBody GoogleSignInRequest request) {
        AuthResponse response = authService.signInWithGoogle(request);
        return ResponseEntity.ok(response);
    }
}
