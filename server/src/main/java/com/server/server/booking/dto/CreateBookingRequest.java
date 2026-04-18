package com.server.server.booking.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Request DTO for creating a booking.
 */
public class CreateBookingRequest {

    @NotBlank(message = "Resource ID is required")
    private String resourceId;

    @NotNull(message = "Date is required")
    @FutureOrPresent(message = "Booking date must be today or in the future")
    private LocalDate date;

    @NotNull(message = "Start time is required")
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    private LocalTime endTime;

    @NotBlank(message = "Purpose is required")
    private String purpose;

    @NotNull(message = "Attendees count is required")
    @Min(value = 1, message = "Attendees must be at least 1")
    private Integer attendees;

    // Recurrence fields
    private String recurrenceType; // "NONE", "DAILY", "WEEKLY", "MONTHLY"
    private LocalDate recurrenceEndDate; // End date for recurrence

    // Constructors
    public CreateBookingRequest() {
    }

    public CreateBookingRequest(String resourceId, LocalDate date, LocalTime startTime,
                                LocalTime endTime, String purpose, Integer attendees) {
        this.resourceId = resourceId;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.purpose = purpose;
        this.attendees = attendees;
        this.recurrenceType = "NONE";
    }

    public CreateBookingRequest(String resourceId, LocalDate date, LocalTime startTime,
                                LocalTime endTime, String purpose, Integer attendees,
                                String recurrenceType, LocalDate recurrenceEndDate) {
        this.resourceId = resourceId;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.purpose = purpose;
        this.attendees = attendees;
        this.recurrenceType = recurrenceType != null ? recurrenceType : "NONE";
        this.recurrenceEndDate = recurrenceEndDate;
    }

    // Getters and Setters
    public String getResourceId() {
        return resourceId;
    }

    public void setResourceId(String resourceId) {
        this.resourceId = resourceId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public Integer getAttendees() {
        return attendees;
    }

    public void setAttendees(Integer attendees) {
        this.attendees = attendees;
    }

    public String getRecurrenceType() {
        return recurrenceType != null ? recurrenceType : "NONE";
    }

    public void setRecurrenceType(String recurrenceType) {
        this.recurrenceType = recurrenceType != null ? recurrenceType : "NONE";
    }

    public LocalDate getRecurrenceEndDate() {
        return recurrenceEndDate;
    }

    public void setRecurrenceEndDate(LocalDate recurrenceEndDate) {
        this.recurrenceEndDate = recurrenceEndDate;
    }
}
