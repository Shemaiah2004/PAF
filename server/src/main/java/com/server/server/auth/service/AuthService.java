package com.server.server.auth.service;

import com.server.server.auth.dto.AuthResponse;
import com.server.server.auth.dto.AuthResponses;
import com.server.server.auth.dto.GoogleSignInRequest;
import com.server.server.auth.dto.SignInRequest;
import com.server.server.auth.dto.SignUpRequest;
import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.github.GitHubUserProfile;
import com.server.server.auth.google.GoogleIdentityVerifier;
import com.server.server.auth.google.GoogleUserProfile;
import com.server.server.auth.linkedin.LinkedInUserProfile;
import com.server.server.auth.exception.DuplicateEmailException;
import com.server.server.auth.exception.InvalidCredentialsException;
import com.server.server.auth.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

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
        return executeWithDatabaseLogging("signUp", request.email(), () -> {
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

                return AuthResponses.fromUser(savedUser, "Account created successfully.");
            } catch (DuplicateKeyException exception) {
                throw new DuplicateEmailException("An account with this email already exists");
            }
        });
    }

    public AuthResponse signIn(SignInRequest request) {
        return executeWithDatabaseLogging("signIn", request.email(), () -> {
            String email = request.email().trim().toLowerCase(Locale.ROOT);

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

            if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
                throw new InvalidCredentialsException(resolveExternalSignInMessage(user));
            }

            if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
                throw new InvalidCredentialsException("Invalid email or password");
            }

            User normalizedUser = ensureUserRole(user);
            return AuthResponses.fromUser(normalizedUser, "Signed in successfully.");
        });
    }

    public AuthResponse signInWithGoogle(GoogleSignInRequest request) {
        return executeWithDatabaseLogging("signInWithGoogle", null, () -> {
            GoogleUserProfile googleUserProfile = googleIdentityVerifier.verify(request.credential());

            if (!googleUserProfile.emailVerified()) {
                throw new InvalidCredentialsException("Your Google account email is not verified.");
            }

            User user = userRepository.findByGoogleSubject(googleUserProfile.subject())
                    .orElseGet(() -> userRepository.findByEmail(googleUserProfile.email())
                            .map(existingUser -> {
                                if ((existingUser.getGoogleSubject() == null || existingUser.getGoogleSubject().isBlank())
                                        && usesDifferentSignInMethod(existingUser, "GOOGLE")) {
                                    throw new InvalidCredentialsException(
                                            "This email already belongs to another sign-in method. Use your existing sign-in option.");
                                }

                                return existingUser;
                            })
                            .orElseGet(User::new));

            boolean isNewUser = user.getId() == null;

            if (user.getGoogleSubject() == null || user.getGoogleSubject().isBlank()) {
                user.setGoogleSubject(googleUserProfile.subject());
            }

            user.setEmail(googleUserProfile.email());
            setIfText(user::setDisplayName, googleUserProfile.displayName());
            setIfText(user::setPhotoUrl, googleUserProfile.pictureUrl());
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
                return AuthResponses.fromUser(savedUser, message);
            } catch (DuplicateKeyException exception) {
                throw new DuplicateEmailException("An account with this email already exists");
            }
        });
    }

    public AuthResponse signInWithLinkedIn(LinkedInUserProfile linkedInUserProfile) {
        return executeWithDatabaseLogging("signInWithLinkedIn", linkedInUserProfile.email(), () -> {
            if (Boolean.FALSE.equals(linkedInUserProfile.emailVerified())) {
                throw new InvalidCredentialsException("Your LinkedIn account email is not verified.");
            }

            if (linkedInUserProfile.email() == null || linkedInUserProfile.email().isBlank()) {
                throw new InvalidCredentialsException(
                        "Your LinkedIn account did not provide an email address.");
            }

            User user = userRepository.findByLinkedinSubject(linkedInUserProfile.subject())
                    .orElseGet(() -> userRepository.findByEmail(linkedInUserProfile.email())
                            .map(existingUser -> {
                                if ((existingUser.getLinkedinSubject() == null || existingUser.getLinkedinSubject().isBlank())
                                        && usesDifferentSignInMethod(existingUser, "LINKEDIN")) {
                                    throw new InvalidCredentialsException(
                                            "This email already belongs to another sign-in method. Use your existing sign-in option.");
                                }

                                return existingUser;
                            })
                            .orElseGet(User::new));

            boolean isNewUser = user.getId() == null;

            if (user.getLinkedinSubject() == null || user.getLinkedinSubject().isBlank()) {
                user.setLinkedinSubject(linkedInUserProfile.subject());
            }

            user.setEmail(linkedInUserProfile.email());
            setIfText(user::setDisplayName, resolveLinkedInDisplayName(linkedInUserProfile));
            setIfText(user::setPhotoUrl, linkedInUserProfile.pictureUrl());
            if (user.getRole() == null) {
                user.setRole(UserRole.USER);
            }

            if (isNewUser) {
                user.setCreatedAt(LocalDateTime.now());
            }

            try {
                User savedUser = userRepository.save(user);
                String message = isNewUser
                        ? "LinkedIn account connected successfully."
                        : "Signed in with LinkedIn successfully.";
                return AuthResponses.fromUser(savedUser, message);
            } catch (DuplicateKeyException exception) {
                throw new DuplicateEmailException("An account with this email already exists");
            }
        });
    }

    public AuthResponse signInWithGitHub(GitHubUserProfile gitHubUserProfile) {
        return executeWithDatabaseLogging("signInWithGitHub", gitHubUserProfile.email(), () -> {
            if (!hasText(gitHubUserProfile.subject())) {
                throw new InvalidCredentialsException(
                        "GitHub sign-in did not return a valid account identifier.");
            }

            if (Boolean.FALSE.equals(gitHubUserProfile.emailVerified())) {
                throw new InvalidCredentialsException("Your GitHub account email is not verified.");
            }

            if (gitHubUserProfile.email() == null || gitHubUserProfile.email().isBlank()) {
                throw new InvalidCredentialsException(
                        "Your GitHub account did not provide a verified email address.");
            }

            User user = userRepository.findByGithubSubject(gitHubUserProfile.subject())
                    .orElseGet(() -> userRepository.findByEmail(gitHubUserProfile.email())
                            .map(existingUser -> {
                                if ((existingUser.getGithubSubject() == null || existingUser.getGithubSubject().isBlank())
                                        && usesDifferentSignInMethod(existingUser, "GITHUB")) {
                                    throw new InvalidCredentialsException(
                                            "This email already belongs to another sign-in method. Use your existing sign-in option.");
                                }

                                return existingUser;
                            })
                            .orElseGet(User::new));

            boolean isNewUser = user.getId() == null;

            if (user.getGithubSubject() == null || user.getGithubSubject().isBlank()) {
                user.setGithubSubject(gitHubUserProfile.subject());
            }

            user.setEmail(gitHubUserProfile.email());
            setIfText(user::setDisplayName, resolveGitHubDisplayName(gitHubUserProfile));
            setIfText(user::setPhotoUrl, gitHubUserProfile.pictureUrl());
            if (user.getRole() == null) {
                user.setRole(UserRole.USER);
            }

            if (isNewUser) {
                user.setCreatedAt(LocalDateTime.now());
            }

            try {
                User savedUser = userRepository.save(user);
                String message = isNewUser
                        ? "GitHub account connected successfully."
                        : "Signed in with GitHub successfully.";
                return AuthResponses.fromUser(savedUser, message);
            } catch (DuplicateKeyException exception) {
                throw new DuplicateEmailException("An account with this email already exists");
            }
        });
    }

    private User ensureUserRole(User user) {
        if (user.getRole() != null) {
            return user;
        }

        user.setRole(UserRole.USER);
        return userRepository.save(user);
    }

    private boolean usesDifferentSignInMethod(User user, String provider) {
        boolean usesPassword = hasText(user.getPasswordHash());
        boolean usesGoogle = hasText(user.getGoogleSubject()) && !"GOOGLE".equals(provider);
        boolean usesLinkedIn = hasText(user.getLinkedinSubject()) && !"LINKEDIN".equals(provider);
        boolean usesGitHub = hasText(user.getGithubSubject()) && !"GITHUB".equals(provider);
        return usesPassword || usesGoogle || usesLinkedIn || usesGitHub;
    }

    private String resolveLinkedInDisplayName(LinkedInUserProfile linkedInUserProfile) {
        if (hasText(linkedInUserProfile.displayName())) {
            return linkedInUserProfile.displayName().trim();
        }

        String firstName = linkedInUserProfile.givenName();
        String lastName = linkedInUserProfile.familyName();

        if (hasText(firstName) && hasText(lastName)) {
            return firstName.trim() + " " + lastName.trim();
        }

        if (hasText(firstName)) {
            return firstName.trim();
        }

        return hasText(lastName) ? lastName.trim() : null;
    }

    private String resolveGitHubDisplayName(GitHubUserProfile gitHubUserProfile) {
        if (hasText(gitHubUserProfile.displayName())) {
            return gitHubUserProfile.displayName().trim();
        }

        return hasText(gitHubUserProfile.username())
                ? gitHubUserProfile.username().trim()
                : null;
    }

    private void setIfText(Consumer<String> setter, String value) {
        if (hasText(value)) {
            setter.accept(value.trim());
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String resolveExternalSignInMessage(User user) {
        if (hasText(user.getLinkedinSubject())) {
            return "This account uses LinkedIn sign-in. Continue with LinkedIn.";
        }

        if (hasText(user.getGithubSubject())) {
            return "This account uses GitHub sign-in. Continue with GitHub.";
        }

        if (hasText(user.getGoogleSubject())) {
            return "This account uses Google sign-in. Continue with Google.";
        }

        return "This account uses a social sign-in provider. Continue with your connected account.";
    }

    private <T> T executeWithDatabaseLogging(String operation, String email, Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (DataAccessException exception) {
            logger.error(
                    "Authentication database query failed. operation='{}', email='{}'",
                    operation,
                    email == null ? "unknown" : email,
                    exception);
            throw exception;
        }
    }
}
