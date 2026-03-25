package com.server.server.ticketing.repository;

import com.server.server.ticketing.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findAllByCreatedByIdOrderByCreatedAtDesc(Long createdById);

    List<Ticket> findAllByOrderByCreatedAtDesc();
}
