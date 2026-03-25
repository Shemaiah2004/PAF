package com.server.server.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.user.dto.UserTableItemResponse;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

@ExtendWith(MockitoExtension.class)
class UserQueryServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void getUsersForTableFallsBackToEmailAndUserRole() {
        User googleUser = new User();
        googleUser.setId("google-user");
        googleUser.setEmail("hettiarachchianuk01@gmail.com");
        googleUser.setGoogleSubject("116469083570081638910");
        googleUser.setDisplayName("   ");
        googleUser.setPhotoUrl("https://example.com/photo.png");
        googleUser.setCreatedAt(LocalDateTime.of(2026, 3, 21, 9, 47, 12));

        User adminUser = new User();
        adminUser.setId("admin-user");
        adminUser.setEmail("admin@example.com");
        adminUser.setDisplayName("Admin User");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setCreatedAt(LocalDateTime.of(2026, 3, 21, 10, 26, 59));

        when(userRepository.findAll(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("email"))))
                .thenReturn(List.of(adminUser, googleUser));

        UserQueryService userQueryService = new UserQueryService(userRepository);

        List<UserTableItemResponse> response = userQueryService.getUsersForTable(null, null, null);

        assertEquals(2, response.size());
        assertEquals("Admin User", response.get(0).displayName());
        assertEquals(UserRole.ADMIN, response.get(0).role());
        assertEquals("LOCAL", response.get(0).provider());
        assertEquals("hettiarachchianuk01@gmail.com", response.get(1).displayName());
        assertEquals(UserRole.USER, response.get(1).role());
        assertEquals("GOOGLE", response.get(1).provider());
        verify(userRepository).findAll(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("email")));
    }

    @Test
    void getUsersForTableAppliesDisplayNameEmailAndRoleFilters() {
        User technicianUser = new User();
        technicianUser.setId("tech-user");
        technicianUser.setEmail("tech@example.com");
        technicianUser.setDisplayName("Technical User");
        technicianUser.setRole(UserRole.TECHNICIAN);

        User managerUser = new User();
        managerUser.setId("manager-user");
        managerUser.setEmail("manager@example.com");
        managerUser.setDisplayName("Manager User");
        managerUser.setRole(UserRole.MANAGER);

        when(userRepository.findAll(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("email"))))
                .thenReturn(List.of(managerUser, technicianUser));

        UserQueryService userQueryService = new UserQueryService(userRepository);

        List<UserTableItemResponse> response = userQueryService.getUsersForTable("tech", "example.com", UserRole.TECHNICIAN);

        assertEquals(1, response.size());
        assertEquals("tech@example.com", response.get(0).email());
        assertEquals(UserRole.TECHNICIAN, response.get(0).role());
    }
}
