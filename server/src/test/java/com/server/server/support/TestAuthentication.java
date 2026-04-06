package com.server.server.support;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

public final class TestAuthentication {

    private TestAuthentication() {
    }

    public static RequestPostProcessor authenticatedUser(String userId, UserRole role) {
        return SecurityMockMvcRequestPostProcessors.authentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        userId,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    public static User user(String userId, UserRole role) {
        User user = new User();
        user.setId(userId);
        user.setEmail(userId + "@example.com");
        user.setRole(role);
        return user;
    }
}
