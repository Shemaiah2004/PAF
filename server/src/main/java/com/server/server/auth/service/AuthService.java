package com.server.server.auth.service;

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
import java.time.LocalDateTime;
import java.util.Locale;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final GoogleIdentityVerifier googleIdentityVerifier;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            GoogleIdentityVerifier googleIdentityVerifier) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.googleIdentityVerifier = googleIdentityVerifier;
    }

    public AuthResponse signUp(SignUpRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(email)) {
            throw new DuplicateEmailException("An account with this email already exists");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.USER);
        user.setCreatedAt(LocalDateTime.now());

        try {
            User savedUser = userRepository.save(user);

            return buildAuthResponse(savedUser, "Account created successfully.", "LOCAL");
        } catch (DuplicateKeyException exception) {
            throw new DuplicateEmailException("An account with this email already exists");
        }
    }

    public AuthResponse signIn(SignInRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw new InvalidCredentialsException("This account uses Google sign-in. Continue with Google.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        User normalizedUser = ensureUserRole(user);
        return buildAuthResponse(normalizedUser, "Signed in successfully.", "LOCAL");
    }

    public AuthResponse signInWithGoogle(GoogleSignInRequest request) {
        GoogleUserProfile googleUserProfile = googleIdentityVerifier.verify(request.credential());

        if (!googleUserProfile.emailVerified()) {
            throw new InvalidCredentialsException("Your Google account email is not verified.");
        }

        User user = userRepository.findByGoogleSubject(googleUserProfile.subject())
                .orElseGet(() -> userRepository.findByEmail(googleUserProfile.email())
                        .map(existingUser -> {
                            if (existingUser.getGoogleSubject() == null || existingUser.getGoogleSubject().isBlank()) {
                                if (existingUser.getPasswordHash() != null && !existingUser.getPasswordHash().isBlank()) {
                                    throw new InvalidCredentialsException(
                                            "This email already belongs to a password account. Sign in with email and password.");
                                }
                            }

                            return existingUser;
                        })
                        .orElseGet(User::new));

        boolean isNewUser = user.getId() == null;

        if (user.getGoogleSubject() == null || user.getGoogleSubject().isBlank()) {
            user.setGoogleSubject(googleUserProfile.subject());
        }

        user.setEmail(googleUserProfile.email());
        user.setDisplayName(googleUserProfile.displayName());
        user.setPhotoUrl(googleUserProfile.pictureUrl());
        if (user.getRole() == null) {
            user.setRole(UserRole.USER);
        }

        if (isNewUser) {
            user.setCreatedAt(LocalDateTime.now());
        }

        try {
            User savedUser = userRepository.save(user);
            String message = isNewUser
                    ? "Google account connected successfully."
                    : "Signed in with Google successfully.";
            return buildAuthResponse(savedUser, message, "GOOGLE");
        } catch (DuplicateKeyException exception) {
            throw new DuplicateEmailException("An account with this email already exists");
        }
    }

    private AuthResponse buildAuthResponse(User user, String message, String provider) {
        UserRole role = user.getRole() != null ? user.getRole() : UserRole.USER;

        return new AuthResponse(
                user.getId(),
                user.getEmail(),
                message,
                user.getDisplayName(),
                user.getPhotoUrl(),
                provider,
                role);
    }

    private User ensureUserRole(User user) {
        if (user.getRole() != null) {
            return user;
        }

        user.setRole(UserRole.USER);
        return userRepository.save(user);
    }
}
