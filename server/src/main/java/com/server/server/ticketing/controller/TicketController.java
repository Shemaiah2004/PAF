package com.server.server.ticketing.controller;

import com.server.server.common.ApiResponse;
import com.server.server.ticketing.dto.request.AssignTicketRequest;
import com.server.server.ticketing.dto.request.CreateCommentRequest;
import com.server.server.ticketing.dto.request.CreateTicketRequest;
import com.server.server.ticketing.dto.request.UpdateTicketRequest;
import com.server.server.ticketing.dto.request.UpdateTicketStatusRequest;
import com.server.server.ticketing.dto.response.TicketAnalyticsResponse;
import com.server.server.ticketing.dto.response.CommentResponse;
import com.server.server.ticketing.dto.response.TicketResponse;
import com.server.server.ticketing.dto.response.TicketSummaryResponse;
import com.server.server.ticketing.service.FileStorageService;
import com.server.server.ticketing.service.TicketService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService ticketService;
    private final FileStorageService fileStorageService;

    public TicketController(TicketService ticketService, FileStorageService fileStorageService) {
        this.ticketService = ticketService;
        this.fileStorageService = fileStorageService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TicketResponse>> createTicket(
            @Valid @RequestPart("ticket") CreateTicketRequest request,
            @RequestPart(name = "files", required = false) List<MultipartFile> files) {
        return ResponseEntity.status(201).body(ApiResponse.success(
                "Ticket created successfully",
                ticketService.createTicket(request, files)
        ));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TicketResponse>>> getTickets() {
        return ResponseEntity.ok(ApiResponse.success(
                "Tickets fetched successfully",
                ticketService.getAccessibleTickets()
        ));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<TicketSummaryResponse>> getSummary() {
        return ResponseEntity.ok(ApiResponse.success(
                "Ticket summary fetched successfully",
                ticketService.getSummary()
        ));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<TicketAnalyticsResponse>> getAnalytics() {
        return ResponseEntity.ok(ApiResponse.success(
                "Ticket analytics fetched successfully",
                ticketService.getAnalytics()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> getTicket(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Ticket fetched successfully",
                ticketService.getTicketById(id)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> updateTicket(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTicketRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Ticket updated successfully",
                ticketService.updateTicket(id, request)
        ));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<TicketResponse>> updateStatus(@PathVariable Long id,
                                                                   @Valid @RequestBody UpdateTicketStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Ticket status updated successfully",
                ticketService.updateStatus(id, request)
        ));
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<ApiResponse<TicketResponse>> assignTicket(@PathVariable Long id,
                                                                   @Valid @RequestBody AssignTicketRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Technician assigned successfully",
                ticketService.assignTicket(id, request)
        ));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ApiResponse<CommentResponse>> addComment(@PathVariable Long id,
                                                                  @Valid @RequestBody CreateCommentRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.success(
                "Comment added successfully",
                ticketService.addComment(id, request)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> archiveTicket(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Ticket archived successfully",
                ticketService.archiveTicket(id)
        ));
    }

    @GetMapping("/{ticketId}/attachments/{fileName:.+}")
    public ResponseEntity<Resource> getAttachment(@PathVariable Long ticketId, @PathVariable String fileName) {
        ticketService.assertCanDownloadAttachment(ticketId);
        Resource resource = fileStorageService.loadAsResource(ticketId, fileName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }
}
