package com.server.server.ticketing.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.server.server.auth.entity.UserRole;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Document(collection = "maintenance_incident_tickets")
public class Ticket {

    @Id
    private String id;

    private String ticketId;
    private String title;
    private String description;
    private TicketType type;
    private TicketPriority priority;
    private String category;
    private TicketStatus status;
    private Location location;
    private UserSummary reporter;
    private UserSummary assignedTechnician;
    private boolean requiresExtendedResolution;
    private int slaHours;
    private Instant dueAt;
    private boolean overdue;
    private Instant resolvedAt;
    private Instant closedAt;
    private List<Attachment> attachments = new ArrayList<>();
    private List<Comment> comments = new ArrayList<>();
    private List<ActivityItem> activity = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTicketId() {
        return ticketId;
    }

    public void setTicketId(String ticketId) {
        this.ticketId = ticketId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TicketType getType() {
        return type;
    }

    public void setType(TicketType type) {
        this.type = type;
    }

    public TicketPriority getPriority() {
        return priority;
    }

    public void setPriority(TicketPriority priority) {
        this.priority = priority;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public TicketStatus getStatus() {
        return status;
    }

    public void setStatus(TicketStatus status) {
        this.status = status;
    }

    public Location getLocation() {
        return location;
    }

    public void setLocation(Location location) {
        this.location = location;
    }

    public UserSummary getReporter() {
        return reporter;
    }

    public void setReporter(UserSummary reporter) {
        this.reporter = reporter;
    }

    public UserSummary getAssignedTechnician() {
        return assignedTechnician;
    }

    public void setAssignedTechnician(UserSummary assignedTechnician) {
        this.assignedTechnician = assignedTechnician;
    }

    public boolean isRequiresExtendedResolution() {
        return requiresExtendedResolution;
    }

    public void setRequiresExtendedResolution(boolean requiresExtendedResolution) {
        this.requiresExtendedResolution = requiresExtendedResolution;
    }

    public int getSlaHours() {
        return slaHours;
    }

    public void setSlaHours(int slaHours) {
        this.slaHours = slaHours;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public void setDueAt(Instant dueAt) {
        this.dueAt = dueAt;
    }

    public boolean isOverdue() {
        return overdue;
    }

    public void setOverdue(boolean overdue) {
        this.overdue = overdue;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }

    public List<Attachment> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<Attachment> attachments) {
        this.attachments = attachments;
    }

    public List<Comment> getComments() {
        return comments;
    }

    public void setComments(List<Comment> comments) {
        this.comments = comments;
    }

    public List<ActivityItem> getActivity() {
        return activity;
    }

    public void setActivity(List<ActivityItem> activity) {
        this.activity = activity;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Location {

        private String building;
        private String floor;
        private String room;
        private String campus;
        private String note;

        public String getBuilding() {
            return building;
        }

        public void setBuilding(String building) {
            this.building = building;
        }

        public String getFloor() {
            return floor;
        }

        public void setFloor(String floor) {
            this.floor = floor;
        }

        public String getRoom() {
            return room;
        }

        public void setRoom(String room) {
            this.room = room;
        }

        public String getCampus() {
            return campus;
        }

        public void setCampus(String campus) {
            this.campus = campus;
        }

        public String getNote() {
            return note;
        }

        public void setNote(String note) {
            this.note = note;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UserSummary {

        private String id;
        private String fullName;
        private String email;
        private UserRole role;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getFullName() {
            return fullName;
        }

        public void setFullName(String fullName) {
            this.fullName = fullName;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public UserRole getRole() {
            return role;
        }

        public void setRole(UserRole role) {
            this.role = role;
        }
    }

    public static class Attachment {

        private String id;
        private String fileName;
        private String originalName;
        private String mimeType;
        private long size;
        private String url;
        private Instant uploadedAt;
        private UserSummary uploadedBy;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getFileName() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName = fileName;
        }

        public String getOriginalName() {
            return originalName;
        }

        public void setOriginalName(String originalName) {
            this.originalName = originalName;
        }

        public String getMimeType() {
            return mimeType;
        }

        public void setMimeType(String mimeType) {
            this.mimeType = mimeType;
        }

        public long getSize() {
            return size;
        }

        public void setSize(long size) {
            this.size = size;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        public Instant getUploadedAt() {
            return uploadedAt;
        }

        public void setUploadedAt(Instant uploadedAt) {
            this.uploadedAt = uploadedAt;
        }

        public UserSummary getUploadedBy() {
            return uploadedBy;
        }

        public void setUploadedBy(UserSummary uploadedBy) {
            this.uploadedBy = uploadedBy;
        }
    }

    public static class Comment {

        private String id;
        private String message;
        private Instant createdAt;
        private UserSummary author;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public Instant getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(Instant createdAt) {
            this.createdAt = createdAt;
        }

        public UserSummary getAuthor() {
            return author;
        }

        public void setAuthor(UserSummary author) {
            this.author = author;
        }
    }

    public static class ActivityItem {

        private String id;
        private String action;
        private String message;
        private Instant createdAt;
        private UserSummary actor;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getAction() {
            return action;
        }

        public void setAction(String action) {
            this.action = action;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public Instant getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(Instant createdAt) {
            this.createdAt = createdAt;
        }

        public UserSummary getActor() {
            return actor;
        }

        public void setActor(UserSummary actor) {
            this.actor = actor;
        }
    }
}
