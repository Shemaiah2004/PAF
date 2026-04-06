package com.server.server.user.service;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.user.dto.RoleRequestItemResponse;
import com.server.server.user.dto.RoleRequestDeleteResponse;
import com.server.server.user.dto.RoleRequestMutationResponse;
import com.server.server.user.dto.UserTableItemResponse;
import com.server.server.user.entity.RoleRequest;
import com.server.server.user.entity.RoleRequestStatus;
import com.server.server.user.exception.InvalidRoleRequestException;
import com.server.server.user.exception.RoleRequestNotFoundException;
import com.server.server.user.exception.UserNotFoundException;
import com.server.server.user.repository.RoleRequestRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class RoleRequestService {

    private static final Sort ROLE_REQUEST_SORT = Sort.by(Sort.Order.desc("createdAt"));

    private final RoleRequestRepository roleRequestRepository;
    private final UserRepository userRepository;
    private final UserAccessService userAccessService;
    private final RoleRequestRealtimeService roleRequestRealtimeService;

    public RoleRequestService(
            RoleRequestRepository roleRequestRepository,
            UserRepository userRepository,
            UserAccessService userAccessService,
            RoleRequestRealtimeService roleRequestRealtimeService) {
        this.roleRequestRepository = roleRequestRepository;
        this.userRepository = userRepository;
        this.userAccessService = userAccessService;
        this.roleRequestRealtimeService = roleRequestRealtimeService;
    }

    public List<RoleRequestItemResponse> getMyRoleRequests(String requesterUserId) {
        return roleRequestRepository.findByRequesterUserIdOrderByCreatedAtDesc(requesterUserId).stream()
                .map(this::mapToRoleRequestResponse)
                .toList();
    }

    public List<RoleRequestItemResponse> getAllRoleRequests() {
        return roleRequestRepository.findAll(ROLE_REQUEST_SORT).stream()
                .map(this::mapToRoleRequestResponse)
                .sorted(Comparator
                        .comparing((RoleRequestItemResponse item) -> item.status() == RoleRequestStatus.PENDING ? 0 : 1)
                        .thenComparing(
                                RoleRequestItemResponse::createdAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public RoleRequestMutationResponse createRoleRequest(String requesterUserId, UserRole requestedRole, String description) {
        User requester = userAccessService.getAuthenticatedUser(requesterUserId);
        UserRole currentRole = getUserRole(requester);

        if (currentRole == requestedRole) {
            throw new InvalidRoleRequestException("You already have the " + requestedRole + " role.");
        }

        if (requestedRole.ordinal() < currentRole.ordinal()) {
            throw new InvalidRoleRequestException(
                    "You can only request a role higher than your current " + currentRole + " access.");
        }

        if (roleRequestRepository.existsByRequesterUserIdAndStatus(requesterUserId, RoleRequestStatus.PENDING)) {
            throw new InvalidRoleRequestException("You already have a pending role request. Please wait for admin approval.");
        }

        LocalDateTime now = LocalDateTime.now();

        RoleRequest roleRequest = new RoleRequest();
        roleRequest.setRequesterUserId(requester.getId());
        roleRequest.setRequesterEmail(requester.getEmail());
        roleRequest.setRequesterDisplayName(getDisplayName(requester));
        roleRequest.setCurrentRole(currentRole);
        roleRequest.setRequestedRole(requestedRole);
        roleRequest.setDescription(description.trim());
        roleRequest.setStatus(RoleRequestStatus.PENDING);
        roleRequest.setCreatedAt(now);
        roleRequest.setUpdatedAt(now);

        RoleRequest savedRequest = roleRequestRepository.save(roleRequest);

        RoleRequestMutationResponse response = new RoleRequestMutationResponse(
                "Role request submitted successfully. An admin can review it now.",
                mapToRoleRequestResponse(savedRequest),
                null);

        roleRequestRealtimeService.publishRequestCreated(
                requester.getId(),
                response.request(),
                response.message());

        return response;
    }

    public RoleRequestMutationResponse approveRoleRequest(String adminUserId, String requestId) {
        User adminUser = userAccessService.getAuthenticatedUser(adminUserId);
        RoleRequest roleRequest = roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new RoleRequestNotFoundException("Role request not found."));

        User requester = userRepository.findById(roleRequest.getRequesterUserId())
                .orElseThrow(() -> new UserNotFoundException("User not found."));

        UserRole requestedRole = roleRequest.getRequestedRole() != null ? roleRequest.getRequestedRole() : UserRole.USER;
        UserRole currentUserRole = getUserRole(requester);

        if (roleRequest.getStatus() == RoleRequestStatus.APPROVED) {
            RoleRequestMutationResponse response = new RoleRequestMutationResponse(
                    "Role request was already approved.",
                    mapToRoleRequestResponse(roleRequest),
                    mapToUserResponse(requester));

            roleRequestRealtimeService.publishRequestApproved(
                    adminUser.getId(),
                    response.request(),
                    response.user(),
                    response.message());

            return response;
        }

        if (roleRequest.getStatus() == RoleRequestStatus.REJECTED) {
            throw new InvalidRoleRequestException("Rejected role requests cannot be approved.");
        }

        boolean roleChanged = currentUserRole != requestedRole;
        if (roleChanged) {
            requester.setRole(requestedRole);
            requester = userRepository.save(requester);
        }

        LocalDateTime now = LocalDateTime.now();
        roleRequest.setCurrentRole(requestedRole);
        roleRequest.setStatus(RoleRequestStatus.APPROVED);
        roleRequest.setUpdatedAt(now);
        roleRequest.setReviewedAt(now);
        roleRequest.setReviewedByUserId(adminUser.getId());
        roleRequest.setReviewedByEmail(adminUser.getEmail());
        roleRequest.setRejectionReason(null);

        RoleRequest savedRequest = roleRequestRepository.save(roleRequest);
        String message = roleChanged
                ? "Role request approved and user role updated to " + requestedRole + "."
                : "Role request approved. The user already had the " + requestedRole + " role.";

        RoleRequestMutationResponse response = new RoleRequestMutationResponse(
                message,
                mapToRoleRequestResponse(savedRequest),
                mapToUserResponse(requester));

        roleRequestRealtimeService.publishRequestApproved(
                adminUser.getId(),
                response.request(),
                response.user(),
                response.message());

        return response;
    }

    public RoleRequestMutationResponse rejectRoleRequest(String adminUserId, String requestId, String rejectionReason) {
        User adminUser = userAccessService.getAuthenticatedUser(adminUserId);
        RoleRequest roleRequest = roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new RoleRequestNotFoundException("Role request not found."));

        String normalizedReason = rejectionReason != null ? rejectionReason.trim() : "";
        if (normalizedReason.isEmpty()) {
            throw new InvalidRoleRequestException("Rejection reason is required.");
        }

        if (roleRequest.getStatus() == RoleRequestStatus.APPROVED) {
            throw new InvalidRoleRequestException("Approved role requests cannot be rejected.");
        }

        if (roleRequest.getStatus() == RoleRequestStatus.REJECTED) {
            roleRequest.setRejectionReason(normalizedReason);
            roleRequest.setUpdatedAt(LocalDateTime.now());
            roleRequest.setReviewedAt(roleRequest.getUpdatedAt());
            roleRequest.setReviewedByUserId(adminUser.getId());
            roleRequest.setReviewedByEmail(adminUser.getEmail());

            RoleRequest savedRequest = roleRequestRepository.save(roleRequest);
            RoleRequestMutationResponse response = new RoleRequestMutationResponse(
                    "Role request was already rejected. The rejection reason was updated.",
                    mapToRoleRequestResponse(savedRequest),
                    null);

            roleRequestRealtimeService.publishRequestRejected(
                    adminUser.getId(),
                    response.request(),
                    response.message());

            return response;
        }

        LocalDateTime now = LocalDateTime.now();
        roleRequest.setStatus(RoleRequestStatus.REJECTED);
        roleRequest.setUpdatedAt(now);
        roleRequest.setReviewedAt(now);
        roleRequest.setReviewedByUserId(adminUser.getId());
        roleRequest.setReviewedByEmail(adminUser.getEmail());
        roleRequest.setRejectionReason(normalizedReason);

        RoleRequest savedRequest = roleRequestRepository.save(roleRequest);

        RoleRequestMutationResponse response = new RoleRequestMutationResponse(
                "Role request rejected and feedback sent to the requester.",
                mapToRoleRequestResponse(savedRequest),
                null);

        roleRequestRealtimeService.publishRequestRejected(
                adminUser.getId(),
                response.request(),
                response.message());

        return response;
    }

    public RoleRequestMutationResponse updateRoleRequest(
            String actorUserId,
            String requestId,
            UserRole requestedRole,
            String description) {
        RoleRequest roleRequest = roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new RoleRequestNotFoundException("Role request not found."));

        userAccessService.assertSelfAccess(
                actorUserId,
                roleRequest.getRequesterUserId(),
                "You can only edit your own role requests.");

        if (roleRequest.getStatus() != RoleRequestStatus.PENDING) {
            throw new InvalidRoleRequestException("Only pending role requests can be edited.");
        }

        User requester = userAccessService.getAuthenticatedUser(actorUserId);
        UserRole currentRole = getUserRole(requester);

        if (currentRole == requestedRole) {
            throw new InvalidRoleRequestException("You already have the " + requestedRole + " role.");
        }

        if (requestedRole.ordinal() < currentRole.ordinal()) {
            throw new InvalidRoleRequestException(
                    "You can only request a role higher than your current " + currentRole + " access.");
        }

        roleRequest.setCurrentRole(currentRole);
        roleRequest.setRequestedRole(requestedRole);
        roleRequest.setDescription(description.trim());
        roleRequest.setUpdatedAt(LocalDateTime.now());

        RoleRequest savedRequest = roleRequestRepository.save(roleRequest);

        RoleRequestMutationResponse response = new RoleRequestMutationResponse(
                "Role request updated successfully.",
                mapToRoleRequestResponse(savedRequest),
                null);

        roleRequestRealtimeService.publishRequestUpdated(
                requester.getId(),
                response.request(),
                response.message());

        return response;
    }

    public RoleRequestDeleteResponse deleteRoleRequest(String actorUserId, String requestId) {
        RoleRequest roleRequest = roleRequestRepository.findById(requestId)
                .orElseThrow(() -> new RoleRequestNotFoundException("Role request not found."));

        userAccessService.assertSelfAccess(
                actorUserId,
                roleRequest.getRequesterUserId(),
                "You can only delete your own role requests.");

        RoleRequestItemResponse deletedRequest = mapToRoleRequestResponse(roleRequest);
        roleRequestRepository.delete(roleRequest);

        RoleRequestDeleteResponse response = new RoleRequestDeleteResponse(
                "Role request deleted successfully.",
                roleRequest.getId());

        roleRequestRealtimeService.publishRequestDeleted(
                actorUserId,
                deletedRequest,
                response.message());

        return response;
    }

    private RoleRequestItemResponse mapToRoleRequestResponse(RoleRequest roleRequest) {
        return new RoleRequestItemResponse(
                roleRequest.getId(),
                roleRequest.getRequesterUserId(),
                roleRequest.getRequesterEmail(),
                isNotBlank(roleRequest.getRequesterDisplayName())
                        ? roleRequest.getRequesterDisplayName().trim()
                        : roleRequest.getRequesterEmail(),
                roleRequest.getCurrentRole() != null ? roleRequest.getCurrentRole() : UserRole.USER,
                roleRequest.getRequestedRole() != null ? roleRequest.getRequestedRole() : UserRole.USER,
                roleRequest.getDescription(),
                roleRequest.getStatus() != null ? roleRequest.getStatus() : RoleRequestStatus.PENDING,
                roleRequest.getRejectionReason(),
                roleRequest.getCreatedAt(),
                roleRequest.getUpdatedAt(),
                roleRequest.getReviewedAt());
    }

    private UserTableItemResponse mapToUserResponse(User user) {
        return new UserTableItemResponse(
                user.getId(),
                user.getEmail(),
                getDisplayName(user),
                user.getPhotoUrl(),
                isNotBlank(user.getGoogleSubject()) ? "GOOGLE" : "LOCAL",
                getUserRole(user),
                user.getCreatedAt());
    }

    private UserRole getUserRole(User user) {
        return user.getRole() != null ? user.getRole() : UserRole.USER;
    }

    private String getDisplayName(User user) {
        return isNotBlank(user.getDisplayName()) ? user.getDisplayName().trim() : user.getEmail();
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
