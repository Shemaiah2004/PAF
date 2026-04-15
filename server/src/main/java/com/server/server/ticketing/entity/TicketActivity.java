package com.server.server.ticketing.entity;

import com.server.server.ticketing.enums.TicketActivityAction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "ticket_activity")
public class TicketActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TicketActivityAction action;

    @Column(nullable = false, length = 1000)
    private String message;

    @Column(length = 30)
    private String fromStatus;

    @Column(length = 30)
    private String toStatus;

    @Column(length = 150)
    private String previousAssigneeName;

    @Column(length = 150)
    private String newAssigneeName;

    @Column(nullable = false)
    private boolean internalOnly;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Ticket getTicket() {
        return ticket;
    }

    public void setTicket(Ticket ticket) {
        this.ticket = ticket;
    }

    public User getActor() {
        return actor;
    }

    public void setActor(User actor) {
        this.actor = actor;
    }

    public TicketActivityAction getAction() {
        return action;
    }

    public void setAction(TicketActivityAction action) {
        this.action = action;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(String fromStatus) {
        this.fromStatus = fromStatus;
    }

    public String getToStatus() {
        return toStatus;
    }

    public void setToStatus(String toStatus) {
        this.toStatus = toStatus;
    }

    public String getPreviousAssigneeName() {
        return previousAssigneeName;
    }

    public void setPreviousAssigneeName(String previousAssigneeName) {
        this.previousAssigneeName = previousAssigneeName;
    }

    public String getNewAssigneeName() {
        return newAssigneeName;
    }

    public void setNewAssigneeName(String newAssigneeName) {
        this.newAssigneeName = newAssigneeName;
    }

    public boolean isInternalOnly() {
        return internalOnly;
    }

    public void setInternalOnly(boolean internalOnly) {
        this.internalOnly = internalOnly;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
