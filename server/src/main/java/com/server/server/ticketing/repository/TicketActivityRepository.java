package com.server.server.ticketing.repository;

import com.server.server.ticketing.entity.TicketActivity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketActivityRepository extends JpaRepository<TicketActivity, Long> {
    List<TicketActivity> findAllByTicketIdOrderByCreatedAtAsc(Long ticketId);
}
