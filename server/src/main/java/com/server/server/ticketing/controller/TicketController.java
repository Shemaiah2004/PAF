package com.server.server.ticketing.controller;

import com.server.server.ticketing.dto.AddTicketCommentRequest;
import com.server.server.ticketing.dto.AssignTechnicianRequest;
import com.server.server.ticketing.dto.CreateTicketRequest;
import com.server.server.ticketing.dto.TicketDashboardResponse;
import com.server.server.ticketing.dto.TicketListResponse;
import com.server.server.ticketing.dto.TicketMetaResponse;
import com.server.server.ticketing.dto.TicketReportsResponse;
import com.server.server.ticketing.dto.UpdateTicketRequest;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketPriority;
import com.server.server.ticketing.entity.TicketStatus;
import com.server.server.ticketing.entity.TicketType;
import com.server.server.ticketing.service.TicketService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @GetMapping("/tickets/meta")
    public ResponseEntity<TicketMetaResponse> getMeta() {
        return ResponseEntity.ok(ticketService.getMeta());
    }

    @GetMapping("/tickets")
    public ResponseEntity<TicketListResponse> getTickets(
            Authentication authentication,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TicketType type,
            @RequestParam(required = false) TicketPriority priority,
            @RequestParam(required = false) TicketStatus status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String assignedTechnicianId,
            @RequestParam(name = "overdue", defaultValue = "false") boolean overdueOnly) {
        return ResponseEntity.ok(ticketService.getTickets(
                authentication.getName(),
                search,
                type,
                priority,
                status,
                category,
                location,
                assignedTechnicianId,
                overdueOnly));
    }

    @GetMapping("/tickets/{ticketId}")
    public ResponseEntity<Ticket> getTicketById(
            @PathVariable String ticketId,
            Authentication authentication) {
        return ResponseEntity.ok(ticketService.getTicketById(ticketId, authentication.getName()));
    }

    @PostMapping("/tickets")
    public ResponseEntity<Ticket> createTicket(
            @Valid @RequestBody CreateTicketRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ticketService.createTicket(request, authentication.getName()));
    }

    @PutMapping("/tickets/{ticketId}")
    public ResponseEntity<Ticket> updateTicket(
            @PathVariable String ticketId,
            @RequestBody UpdateTicketRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ticketService.updateTicket(ticketId, request, authentication.getName()));
    }

    @PatchMapping("/tickets/{ticketId}/assign")
    public ResponseEntity<Ticket> assignTechnician(
            @PathVariable String ticketId,
            @RequestBody AssignTechnicianRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ticketService.assignTechnician(
                ticketId,
                request.technicianId(),
                authentication.getName()));
    }

    @PostMapping("/tickets/{ticketId}/comments")
    public ResponseEntity<Ticket> addComment(
            @PathVariable String ticketId,
            @Valid @RequestBody AddTicketCommentRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ticketService.addComment(
                ticketId,
                request.message(),
                authentication.getName()));
    }

    @PostMapping(path = "/tickets/{ticketId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Ticket> addAttachments(
            @PathVariable String ticketId,
            @RequestPart("attachments") List<MultipartFile> attachments,
            Authentication authentication) {
        return ResponseEntity.ok(ticketService.addAttachments(
                ticketId,
                attachments,
                authentication.getName()));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<TicketDashboardResponse> getDashboard(Authentication authentication) {
        return ResponseEntity.ok(ticketService.getDashboard(authentication.getName()));
    }

    @GetMapping("/reports")
    public ResponseEntity<TicketReportsResponse> getReports(Authentication authentication) {
        return ResponseEntity.ok(ticketService.getReports(authentication.getName()));
    }
}
