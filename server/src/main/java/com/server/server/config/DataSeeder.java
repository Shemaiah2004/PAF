package com.server.server.config;

import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.Role;
import com.server.server.ticketing.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() > 0) {
                return;
            }

            userRepository.save(User.of(
                    "System Administrator",
                    "admin@paf.local",
                    passwordEncoder.encode("Admin@123"),
                    Role.ADMIN
            ));
            userRepository.save(User.of(
                    "Field Technician",
                    "tech@paf.local",
                    passwordEncoder.encode("Tech@123"),
                    Role.TECHNICIAN
            ));
            userRepository.save(User.of(
                    "Facility User",
                    "user@paf.local",
                    passwordEncoder.encode("User@123"),
                    Role.USER
            ));
        };
    }
}
