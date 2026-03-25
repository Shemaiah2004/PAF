package com.server.server.ticketing.repository;

import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    List<User> findByRoleOrderByFullNameAsc(Role role);
}
