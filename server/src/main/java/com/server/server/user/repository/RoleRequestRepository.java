package com.server.server.user.repository;

import com.server.server.user.entity.RoleRequest;
import com.server.server.user.entity.RoleRequestStatus;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RoleRequestRepository extends MongoRepository<RoleRequest, String> {

    boolean existsByRequesterUserIdAndStatus(String requesterUserId, RoleRequestStatus status);

    List<RoleRequest> findByRequesterUserIdOrderByCreatedAtDesc(String requesterUserId);
}
