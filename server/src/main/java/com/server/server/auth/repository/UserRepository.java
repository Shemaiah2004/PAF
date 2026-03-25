package com.server.server.auth.repository;

import com.server.server.auth.entity.User;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {

    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);

    Optional<User> findByGoogleSubject(String googleSubject);
}
