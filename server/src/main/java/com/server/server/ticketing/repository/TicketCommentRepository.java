package com.server.server.ticketing.repository;

import com.server.server.ticketing.entity.TicketComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketCommentRepository extends JpaRepository<TicketComment, Long> {
    List<TicketComment> findAllByTicketIdOrderByTimestampAsc(Long ticketId);
}
