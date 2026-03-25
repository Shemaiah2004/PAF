package com.server.server.user.service;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.user.dto.UserRoleUpdateResponse;
import com.server.server.user.dto.UserTableItemResponse;
import com.server.server.user.exception.UserNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserManagementService {

    private final UserRepository userRepository;

    public UserManagementService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserRoleUpdateResponse updateUserRole(String targetUserId, UserRole role) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new UserNotFoundException("User not found."));

        UserRole currentRole = user.getRole() != null ? user.getRole() : UserRole.USER;

        if (currentRole == role) {
            return new UserRoleUpdateResponse(
                    "User already has the " + role + " role.",
                    mapToResponse(user));
        }

        user.setRole(role);
        User savedUser = userRepository.save(user);

        return new UserRoleUpdateResponse(
                "User role updated to " + role + " successfully.",
                mapToResponse(savedUser));
    }

    private UserTableItemResponse mapToResponse(User user) {
        return new UserTableItemResponse(
                user.getId(),
                user.getEmail(),
                isNotBlank(user.getDisplayName()) ? user.getDisplayName().trim() : user.getEmail(),
                user.getPhotoUrl(),
                isNotBlank(user.getGoogleSubject()) ? "GOOGLE" : "LOCAL",
                user.getRole() != null ? user.getRole() : UserRole.USER,
                user.getCreatedAt());
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
