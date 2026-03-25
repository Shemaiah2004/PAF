package com.server.server.ticketing.service;

import com.server.server.ticketing.dto.response.UserProfileResponse;
import com.server.server.ticketing.dto.response.UserSummaryResponse;
import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.Role;
import com.server.server.ticketing.mapper.TicketingMapper;
import com.server.server.ticketing.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;

    public UserService(UserRepository userRepository, CurrentUserService currentUserService) {
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUserProfile() {
        return TicketingMapper.toUserProfile(currentUserService.getCurrentUser());
    }

    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getTechnicians() {
        return userRepository.findByRoleOrderByFullNameAsc(Role.TECHNICIAN)
                .stream()
                .map(TicketingMapper::toUserSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public User getTechnicianById(Long technicianId) {
        User technician = userRepository.findById(technicianId)
                .orElseThrow(() -> new IllegalArgumentException("Technician was not found"));
        if (technician.getRole() != Role.TECHNICIAN) {
            throw new IllegalArgumentException("Selected user is not a technician");
        }
        return technician;
    }
}
