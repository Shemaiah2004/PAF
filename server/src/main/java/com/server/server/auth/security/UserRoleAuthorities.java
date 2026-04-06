package com.server.server.auth.security;

import com.server.server.auth.entity.UserRole;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public final class UserRoleAuthorities {

    private UserRoleAuthorities() {
    }

    public static List<GrantedAuthority> fromRole(UserRole role) {
        UserRole normalizedRole = role != null ? role : UserRole.USER;
        return List.of(new SimpleGrantedAuthority("ROLE_" + normalizedRole.name()));
    }
}
