package com.server.server.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.user.dto.UserRoleUpdateResponse;
import com.server.server.user.exception.UserNotFoundException;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void updateUserRoleAssignsRequestedRole() {
        User user = new User();
        user.setId("user-1");
        user.setEmail("manager@example.com");
        user.setDisplayName("Manager User");
        user.setCreatedAt(LocalDateTime.of(2026, 3, 21, 18, 10, 0));
        user.setRole(UserRole.USER);

        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserManagementService userManagementService = new UserManagementService(userRepository);

        UserRoleUpdateResponse response = userManagementService.updateUserRole("user-1", UserRole.MANAGER);

        assertEquals("User role updated to MANAGER successfully.", response.message());
        assertEquals("user-1", response.user().id());
        assertEquals(UserRole.MANAGER, response.user().role());
        assertEquals("Manager User", response.user().displayName());
        verify(userRepository).save(user);
    }

    @Test
    void updateUserRoleThrowsWhenUserDoesNotExist() {
        when(userRepository.findById("missing-user")).thenReturn(Optional.empty());

        UserManagementService userManagementService = new UserManagementService(userRepository);

        assertThrows(UserNotFoundException.class,
                () -> userManagementService.updateUserRole("missing-user", UserRole.TECHNICIAN));
    }
}
