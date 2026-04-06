package com.server.server.auth.security;

import com.server.server.auth.entity.User;
import com.server.server.auth.repository.UserRepository;
import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class UserSessionRefreshFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    public UserSessionRefreshFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) {
            String userId = authentication.getName();

            if (userId != null && !userId.isBlank()) {
                userRepository.findById(userId)
                        .ifPresentOrElse(
                                user -> refreshAuthentication(authentication, user),
                                () -> clearSession(request));
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();

        return !path.startsWith("/api/")
                || "/api/auth/config".equals(path)
                || "/api/auth/signup".equals(path)
                || "/api/auth/signin".equals(path)
                || "/api/auth/google".equals(path);
    }

    private void refreshAuthentication(Authentication currentAuthentication, User user) {
        UsernamePasswordAuthenticationToken refreshedAuthentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        user.getId(),
                        null,
                        UserRoleAuthorities.fromRole(user.getRole()));
        refreshedAuthentication.setDetails(currentAuthentication.getDetails());
        SecurityContextHolder.getContext().setAuthentication(refreshedAuthentication);
    }

    private void clearSession(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);

        if (session != null) {
            session.invalidate();
        }
    }
}
