package com.server.server.ticketing.controller;

import com.server.server.common.ApiResponse;
import com.server.server.ticketing.dto.request.UpdateCommentRequest;
import com.server.server.ticketing.dto.response.CommentResponse;
import com.server.server.ticketing.service.TicketService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final TicketService ticketService;

    public CommentController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CommentResponse>> updateComment(@PathVariable Long id,
                                                                     @Valid @RequestBody UpdateCommentRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Comment updated successfully", ticketService.updateComment(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(@PathVariable Long id) {
        ticketService.deleteComment(id);
        return ResponseEntity.ok(ApiResponse.success("Comment deleted successfully", null));
    }
}
