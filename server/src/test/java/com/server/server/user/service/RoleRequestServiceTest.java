package com.server.server.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.exception.ForbiddenAccessException;
import com.server.server.auth.repository.UserRepository;
import com.server.server.user.dto.RoleRequestDeleteResponse;
import com.server.server.user.dto.RoleRequestMutationResponse;
import com.server.server.user.entity.RoleRequest;
import com.server.server.user.entity.RoleRequestStatus;
import com.server.server.user.exception.InvalidRoleRequestException;
import com.server.server.user.repository.RoleRequestRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RoleRequestServiceTest {

    @Mock
    private RoleRequestRepository roleRequestRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserAccessService userAccessService;

    @Test
    void createRoleRequestStoresPendingRequest() {
        User requester = new User();
        requester.setId("user-1");
        requester.setEmail("user@example.com");
        requester.setDisplayName("User One");
        requester.setRole(UserRole.USER);
        requester.setCreatedAt(LocalDateTime.of(2026, 3, 21, 19, 10, 0));

        when(userAccessService.getAuthenticatedUser("user-1")).thenReturn(requester);
        when(roleRequestRepository.existsByRequesterUserIdAndStatus("user-1", RoleRequestStatus.PENDING))
                .thenReturn(false);
        when(roleRequestRepository.save(any(RoleRequest.class))).thenAnswer(invocation -> {
            RoleRequest savedRequest = invocation.getArgument(0);
            savedRequest.setId("request-1");
            return savedRequest;
        });

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        RoleRequestMutationResponse response = roleRequestService.createRoleRequest(
                "user-1",
                UserRole.MANAGER,
                "Need manager access for approvals.");

        assertEquals("Role request submitted successfully. An admin can review it now.", response.message());
        assertEquals("request-1", response.request().id());
        assertEquals(UserRole.USER, response.request().currentRole());
        assertEquals(UserRole.MANAGER, response.request().requestedRole());
        assertEquals(RoleRequestStatus.PENDING, response.request().status());
        assertEquals("User One", response.request().requesterDisplayName());
        verify(roleRequestRepository).save(any(RoleRequest.class));
    }

    @Test
    void createRoleRequestRejectsDuplicatePendingRequest() {
        User requester = new User();
        requester.setId("user-1");
        requester.setEmail("user@example.com");
        requester.setRole(UserRole.USER);

        when(userAccessService.getAuthenticatedUser("user-1")).thenReturn(requester);
        when(roleRequestRepository.existsByRequesterUserIdAndStatus("user-1", RoleRequestStatus.PENDING))
                .thenReturn(true);

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        assertThrows(
                InvalidRoleRequestException.class,
                () -> roleRequestService.createRoleRequest(
                        "user-1",
                        UserRole.ADMIN,
                        "Need admin access."));
    }

    @Test
    void approveRoleRequestUpdatesRequesterRoleAndMarksRequestApproved() {
        User adminUser = new User();
        adminUser.setId("admin-user");
        adminUser.setEmail("admin@example.com");
        adminUser.setRole(UserRole.ADMIN);

        User requester = new User();
        requester.setId("user-1");
        requester.setEmail("user@example.com");
        requester.setDisplayName("User One");
        requester.setRole(UserRole.USER);
        requester.setCreatedAt(LocalDateTime.of(2026, 3, 21, 18, 0, 0));

        RoleRequest roleRequest = new RoleRequest();
        roleRequest.setId("request-1");
        roleRequest.setRequesterUserId("user-1");
        roleRequest.setRequesterEmail("user@example.com");
        roleRequest.setRequesterDisplayName("User One");
        roleRequest.setCurrentRole(UserRole.USER);
        roleRequest.setRequestedRole(UserRole.MANAGER);
        roleRequest.setDescription("Need manager access.");
        roleRequest.setStatus(RoleRequestStatus.PENDING);
        roleRequest.setCreatedAt(LocalDateTime.of(2026, 3, 21, 18, 5, 0));
        roleRequest.setUpdatedAt(LocalDateTime.of(2026, 3, 21, 18, 5, 0));

        when(userAccessService.getAuthenticatedUser("admin-user")).thenReturn(adminUser);
        when(roleRequestRepository.findById("request-1")).thenReturn(Optional.of(roleRequest));
        when(userRepository.findById("user-1")).thenReturn(Optional.of(requester));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(roleRequestRepository.save(any(RoleRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        RoleRequestMutationResponse response = roleRequestService.approveRoleRequest("admin-user", "request-1");

        assertEquals("Role request approved and user role updated to MANAGER.", response.message());
        assertEquals(UserRole.MANAGER, response.user().role());
        assertEquals(UserRole.MANAGER, response.request().currentRole());
        assertEquals(RoleRequestStatus.APPROVED, response.request().status());
        verify(userRepository).save(requester);
        verify(roleRequestRepository).save(roleRequest);
    }

    @Test
    void updateRoleRequestUpdatesPendingRequestForRequester() {
        User requester = new User();
        requester.setId("user-1");
        requester.setEmail("user@example.com");
        requester.setRole(UserRole.USER);

        RoleRequest roleRequest = new RoleRequest();
        roleRequest.setId("request-1");
        roleRequest.setRequesterUserId("user-1");
        roleRequest.setRequestedRole(UserRole.MANAGER);
        roleRequest.setDescription("Initial description.");
        roleRequest.setStatus(RoleRequestStatus.PENDING);

        when(roleRequestRepository.findById("request-1")).thenReturn(Optional.of(roleRequest));
        when(userAccessService.getAuthenticatedUser("user-1")).thenReturn(requester);
        when(roleRequestRepository.save(any(RoleRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        RoleRequestMutationResponse response = roleRequestService.updateRoleRequest(
                "user-1",
                "request-1",
                UserRole.ADMIN,
                "Updated reason.");

        assertEquals("Role request updated successfully.", response.message());
        assertEquals(UserRole.ADMIN, response.request().requestedRole());
        assertEquals("Updated reason.", response.request().description());
        verify(userAccessService).assertSelfAccess(
                "user-1",
                "user-1",
                "You can only edit your own role requests.");
        verify(roleRequestRepository).save(roleRequest);
    }

    @Test
    void updateRoleRequestRejectsDifferentUser() {
        RoleRequest roleRequest = new RoleRequest();
        roleRequest.setId("request-1");
        roleRequest.setRequesterUserId("user-1");
        roleRequest.setStatus(RoleRequestStatus.PENDING);

        when(roleRequestRepository.findById("request-1")).thenReturn(Optional.of(roleRequest));
        org.mockito.Mockito.doThrow(new ForbiddenAccessException("You can only edit your own role requests."))
                .when(userAccessService)
                .assertSelfAccess("user-2", "user-1", "You can only edit your own role requests.");

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        assertThrows(
                ForbiddenAccessException.class,
                () -> roleRequestService.updateRoleRequest(
                        "user-2",
                        "request-1",
                        UserRole.MANAGER,
                        "Updated reason."));
    }

    @Test
    void deleteRoleRequestRemovesExistingRequest() {
        RoleRequest roleRequest = new RoleRequest();
        roleRequest.setId("request-1");
        roleRequest.setRequesterUserId("user-1");

        when(roleRequestRepository.findById("request-1")).thenReturn(Optional.of(roleRequest));

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        RoleRequestDeleteResponse response = roleRequestService.deleteRoleRequest("user-1", "request-1");

        assertEquals("Role request deleted successfully.", response.message());
        assertEquals("request-1", response.requestId());
        verify(userAccessService).assertSelfOrAdmin(
                "user-1",
                "user-1",
                "You can only delete your own role requests.");
        verify(roleRequestRepository).delete(roleRequest);
    }

    @Test
    void deleteRoleRequestRejectsDifferentStandardUser() {
        RoleRequest roleRequest = new RoleRequest();
        roleRequest.setId("request-1");
        roleRequest.setRequesterUserId("user-1");

        when(roleRequestRepository.findById("request-1")).thenReturn(Optional.of(roleRequest));
        org.mockito.Mockito.doThrow(new ForbiddenAccessException("You can only delete your own role requests."))
                .when(userAccessService)
                .assertSelfOrAdmin("user-2", "user-1", "You can only delete your own role requests.");

        RoleRequestService roleRequestService = new RoleRequestService(
                roleRequestRepository,
                userRepository,
                userAccessService);

        assertThrows(
                ForbiddenAccessException.class,
                () -> roleRequestService.deleteRoleRequest("user-2", "request-1"));
    }
}
