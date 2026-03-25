package com.server.server.user.entity;

import com.server.server.auth.entity.UserRole;
import java.time.LocalDateTime;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "role_requests")
public class RoleRequest {

    @Id
    private String id;

    @Indexed
    private String requesterUserId;

    private String requesterEmail;

    private String requesterDisplayName;

    private UserRole currentRole;

    private UserRole requestedRole;

    private String description;

    private RoleRequestStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime reviewedAt;

    private String reviewedByUserId;

    private String reviewedByEmail;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRequesterUserId() {
        return requesterUserId;
    }

    public void setRequesterUserId(String requesterUserId) {
        this.requesterUserId = requesterUserId;
    }

    public String getRequesterEmail() {
        return requesterEmail;
    }

    public void setRequesterEmail(String requesterEmail) {
        this.requesterEmail = requesterEmail;
    }

    public String getRequesterDisplayName() {
        return requesterDisplayName;
    }

    public void setRequesterDisplayName(String requesterDisplayName) {
        this.requesterDisplayName = requesterDisplayName;
    }

    public UserRole getCurrentRole() {
        return currentRole;
    }

    public void setCurrentRole(UserRole currentRole) {
        this.currentRole = currentRole;
    }

    public UserRole getRequestedRole() {
        return requestedRole;
    }

    public void setRequestedRole(UserRole requestedRole) {
        this.requestedRole = requestedRole;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public RoleRequestStatus getStatus() {
        return status;
    }

    public void setStatus(RoleRequestStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewedByUserId() {
        return reviewedByUserId;
    }

    public void setReviewedByUserId(String reviewedByUserId) {
        this.reviewedByUserId = reviewedByUserId;
    }

    public String getReviewedByEmail() {
        return reviewedByEmail;
    }

    public void setReviewedByEmail(String reviewedByEmail) {
        this.reviewedByEmail = reviewedByEmail;
    }
}
