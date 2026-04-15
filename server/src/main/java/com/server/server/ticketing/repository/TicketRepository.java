package com.server.server.ticketing.repository;

import com.server.server.ticketing.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findAllByCreatedByIdOrderByCreatedAtDesc(Long createdById);

    List<Ticket> findAllByOrderByCreatedAtDesc();

    List<Ticket> findAllByArchivedFalseOrderByCreatedAtDesc();

    List<Ticket> findAllByCreatedByIdAndArchivedFalseOrderByCreatedAtDesc(Long createdById);

    Optional<Ticket> findTopByTicketNumberStartingWithOrderByTicketNumberDesc(String prefix);

    List<Ticket> findAllByArchivedFalseAndDueAtBeforeAndStatusNotIn(LocalDateTime dueAt, List<com.server.server.ticketing.enums.TicketStatus> statuses);
}
