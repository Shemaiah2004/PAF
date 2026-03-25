package com.server.server.user.service;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.user.dto.UserTableItemResponse;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class UserQueryService {

    private static final Sort USER_LIST_SORT = Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.asc("email"));

    private final UserRepository userRepository;

    public UserQueryService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserTableItemResponse> getUsersForTable(
            String displayNameFilter,
            String emailFilter,
            UserRole roleFilter) {
        return userRepository.findAll(USER_LIST_SORT).stream()
                .filter(user -> matchesDisplayName(user, displayNameFilter))
                .filter(user -> matchesEmail(user, emailFilter))
                .filter(user -> matchesRole(user, roleFilter))
                .map(this::mapToResponse)
                .toList();
    }

    private UserTableItemResponse mapToResponse(User user) {
        String email = user.getEmail();
        String displayName = user.getDisplayName();
        UserRole role = user.getRole() != null ? user.getRole() : UserRole.USER;
        String provider = isNotBlank(user.getGoogleSubject()) ? "GOOGLE" : "LOCAL";

        return new UserTableItemResponse(
                user.getId(),
                email,
                isNotBlank(displayName) ? displayName.trim() : email,
                user.getPhotoUrl(),
                provider,
                role,
                user.getCreatedAt());
    }

    private boolean matchesDisplayName(User user, String displayNameFilter) {
        String normalizedFilter = normalizeFilter(displayNameFilter);
        if (normalizedFilter == null) {
            return true;
        }

        String displayName = isNotBlank(user.getDisplayName()) ? user.getDisplayName().trim() : user.getEmail();
        return normalizeText(displayName).contains(normalizedFilter);
    }

    private boolean matchesEmail(User user, String emailFilter) {
        String normalizedFilter = normalizeFilter(emailFilter);
        if (normalizedFilter == null) {
            return true;
        }

        return normalizeText(user.getEmail()).contains(normalizedFilter);
    }

    private boolean matchesRole(User user, UserRole roleFilter) {
        if (roleFilter == null) {
            return true;
        }

        UserRole role = user.getRole() != null ? user.getRole() : UserRole.USER;
        return role == roleFilter;
    }

    private String normalizeFilter(String value) {
        if (!isNotBlank(value)) {
            return null;
        }

        return normalizeText(value);
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
