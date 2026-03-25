package com.server.server.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.server.server.auth.dto.AuthResponse;
import com.server.server.auth.dto.GoogleSignInRequest;
import com.server.server.auth.dto.SignInRequest;
import com.server.server.auth.dto.SignUpRequest;
import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.google.GoogleIdentityVerifier;
import com.server.server.auth.google.GoogleUserProfile;
import com.server.server.auth.exception.DuplicateEmailException;
import com.server.server.auth.exception.InvalidCredentialsException;
import com.server.server.auth.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private GoogleIdentityVerifier googleIdentityVerifier;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, googleIdentityVerifier);
    }

    @Test
    void signUpThrowsWhenEmailAlreadyExists() {
        SignUpRequest request = new SignUpRequest("user@example.com", "secret123");
        when(userRepository.existsByEmail("user@example.com")).thenReturn(true);

        assertThrows(DuplicateEmailException.class, () -> authService.signUp(request));
    }

    @Test
    void signInReturnsAuthenticatedUserWhenCredentialsAreValid() {
        User user = new User();
        user.setId("user-123");
        user.setEmail("user@example.com");
        user.setPasswordHash("encoded-password");
        user.setRole(UserRole.USER);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encoded-password")).thenReturn(true);

        AuthResponse response = authService.signIn(new SignInRequest(" USER@example.com ", "secret123"));

        assertEquals("user-123", response.userId());
        assertEquals("user@example.com", response.email());
        assertEquals("Signed in successfully.", response.message());
        assertEquals(UserRole.USER, response.role());
        verify(userRepository).findByEmail("user@example.com");
    }

    @Test
    void signInThrowsWhenPasswordDoesNotMatch() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("encoded-password");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

        assertThrows(
                InvalidCredentialsException.class,
                () -> authService.signIn(new SignInRequest("user@example.com", "wrong-password")));
    }

    @Test
    void signInAssignsDefaultUserRoleWhenMissing() {
        User user = new User();
        user.setId("user-123");
        user.setEmail("user@example.com");
        user.setPasswordHash("encoded-password");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encoded-password")).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = authService.signIn(new SignInRequest("user@example.com", "secret123"));

        assertEquals(UserRole.USER, response.role());
        verify(userRepository).save(user);
    }

    @Test
    void signInWithGoogleCreatesUserWhenEmailDoesNotExist() {
        GoogleUserProfile googleUserProfile = new GoogleUserProfile(
                "google-subject-123",
                "user@example.com",
                true,
                "Google User",
                "https://example.com/photo.png",
                null);

        when(googleIdentityVerifier.verify("google-token")).thenReturn(googleUserProfile);
        when(userRepository.findByGoogleSubject("google-subject-123")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User savedUser = invocation.getArgument(0);
            savedUser.setId("user-123");
            return savedUser;
        });

        AuthResponse response = authService.signInWithGoogle(new GoogleSignInRequest("google-token"));

        assertEquals("user-123", response.userId());
        assertEquals("user@example.com", response.email());
        assertEquals("Google User", response.displayName());
        assertEquals("GOOGLE", response.provider());
        assertEquals(UserRole.USER, response.role());
    }

    @Test
    void signInWithGoogleRejectsExistingPasswordAccount() {
        User user = new User();
        user.setId("user-123");
        user.setEmail("user@example.com");
        user.setPasswordHash("encoded-password");

        GoogleUserProfile googleUserProfile = new GoogleUserProfile(
                "google-subject-123",
                "user@example.com",
                true,
                "Google User",
                "https://example.com/photo.png",
                null);

        when(googleIdentityVerifier.verify("google-token")).thenReturn(googleUserProfile);
        when(userRepository.findByGoogleSubject("google-subject-123")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        assertThrows(
                InvalidCredentialsException.class,
                () -> authService.signInWithGoogle(new GoogleSignInRequest("google-token")));
    }
}
