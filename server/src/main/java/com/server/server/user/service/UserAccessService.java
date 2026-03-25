package com.server.server.user.service;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.exception.ForbiddenAccessException;
import com.server.server.auth.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserAccessService {

    private final UserRepository userRepository;

    public UserAccessService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getAuthenticatedUser(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ForbiddenAccessException("You must be signed in to access this resource.");
        }

        return userRepository.findById(userId)
                .orElseThrow(() -> new ForbiddenAccessException("You must be signed in to access this resource."));
    }

    public void assertAdminAccess(String userId) {
        User user = getAuthenticatedUser(userId);

        if (!isAdmin(user)) {
            throw new ForbiddenAccessException("Only admins can access this resource.");
        }
    }

    public void assertSelfOrAdmin(String actorUserId, String targetUserId, String message) {
        User actor = getAuthenticatedUser(actorUserId);

        if (actor.getId().equals(targetUserId) || isAdmin(actor)) {
            return;
        }

        throw new ForbiddenAccessException(message);
    }

    public void assertSelfAccess(String actorUserId, String targetUserId, String message) {
        User actor = getAuthenticatedUser(actorUserId);

        if (actor.getId().equals(targetUserId)) {
            return;
        }

        throw new ForbiddenAccessException(message);
    }

    private boolean isAdmin(User user) {
        UserRole role = user.getRole() != null ? user.getRole() : UserRole.USER;
        return role == UserRole.ADMIN;
    }
}
