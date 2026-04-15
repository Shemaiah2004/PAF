package com.server.server.ticketing.service;

import com.server.server.auth.entity.UserRole;
import com.server.server.auth.repository.UserRepository;
import com.server.server.exception.ResourceNotFoundException;
import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.Role;
import com.server.server.ticketing.repository.TicketingUserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CurrentUserService implements UserDetailsService {

    private static final String SESSION_SYNC_PLACEHOLDER_PASSWORD = "{noop}SESSION_AUTH_ONLY";

    private final TicketingUserRepository ticketingUserRepository;
    private final UserRepository authUserRepository;

    public CurrentUserService(TicketingUserRepository ticketingUserRepository, UserRepository authUserRepository) {
        this.ticketingUserRepository = ticketingUserRepository;
        this.authUserRepository = authUserRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = ticketingUserRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }

    public User getCurrentUser() {
        String authenticatedUserId = SecurityContextHolder.getContext().getAuthentication().getName();
        com.server.server.auth.entity.User authUser = authUserRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user was not found"));

        return ticketingUserRepository.findByEmail(authUser.getEmail())
                .map(ticketingUser -> syncTicketingUser(ticketingUser, authUser))
                .orElseGet(() -> createTicketingUser(authUser));
    }

    private User syncTicketingUser(User ticketingUser, com.server.server.auth.entity.User authUser) {
        boolean changed = false;

        String fullName = getDisplayName(authUser);
        if (!fullName.equals(ticketingUser.getFullName())) {
            ticketingUser.setFullName(fullName);
            changed = true;
        }

        Role mappedRole = mapRole(authUser.getRole());
        if (ticketingUser.getRole() != mappedRole) {
            ticketingUser.setRole(mappedRole);
            changed = true;
        }

        String password = getTicketingPassword(authUser);
        if (!password.equals(ticketingUser.getPassword())) {
            ticketingUser.setPassword(password);
            changed = true;
        }

        return changed ? ticketingUserRepository.save(ticketingUser) : ticketingUser;
    }

    private User createTicketingUser(com.server.server.auth.entity.User authUser) {
        return ticketingUserRepository.save(User.of(
                getDisplayName(authUser),
                authUser.getEmail(),
                getTicketingPassword(authUser),
                mapRole(authUser.getRole())));
    }

    private String getDisplayName(com.server.server.auth.entity.User authUser) {
        if (authUser.getDisplayName() != null && !authUser.getDisplayName().isBlank()) {
            return authUser.getDisplayName().trim();
        }

        return authUser.getEmail();
    }

    private String getTicketingPassword(com.server.server.auth.entity.User authUser) {
        if (authUser.getPasswordHash() != null && !authUser.getPasswordHash().isBlank()) {
            return authUser.getPasswordHash();
        }

        return SESSION_SYNC_PLACEHOLDER_PASSWORD;
    }

    private Role mapRole(UserRole authRole) {
        if (authRole == null) {
            return Role.USER;
        }

        return switch (authRole) {
            case ADMIN -> Role.ADMIN;
            case TECHNICIAN -> Role.TECHNICIAN;
            case USER, MANAGER -> Role.USER;
        };
    }
}
