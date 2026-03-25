package com.server.server.ticketing.service;

import com.server.server.exception.AccessDeniedOperationException;
import com.server.server.exception.InvalidTicketTransitionException;
import com.server.server.exception.ResourceNotFoundException;
import com.server.server.ticketing.dto.request.AssignTicketRequest;
import com.server.server.ticketing.dto.request.CreateCommentRequest;
import com.server.server.ticketing.dto.request.CreateTicketRequest;
import com.server.server.ticketing.dto.request.UpdateCommentRequest;
import com.server.server.ticketing.dto.request.UpdateTicketStatusRequest;
import com.server.server.ticketing.dto.response.CommentResponse;
import com.server.server.ticketing.dto.response.TicketResponse;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketComment;
import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.Role;
import com.server.server.ticketing.enums.TicketStatus;
import com.server.server.ticketing.mapper.TicketingMapper;
import com.server.server.ticketing.repository.TicketCommentRepository;
import com.server.server.ticketing.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class TicketService {

    private static final Map<TicketStatus, Set<TicketStatus>> TRANSITIONS = new EnumMap<>(TicketStatus.class);

    static {
        TRANSITIONS.put(TicketStatus.OPEN, Set.of(TicketStatus.IN_PROGRESS, TicketStatus.REJECTED));
        TRANSITIONS.put(TicketStatus.IN_PROGRESS, Set.of(TicketStatus.RESOLVED));
        TRANSITIONS.put(TicketStatus.RESOLVED, Set.of(TicketStatus.CLOSED));
        TRANSITIONS.put(TicketStatus.CLOSED, Set.of());
        TRANSITIONS.put(TicketStatus.REJECTED, Set.of());
    }

    private final TicketRepository ticketRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final CurrentUserService currentUserService;
    private final UserService userService;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    public TicketService(TicketRepository ticketRepository,
                         TicketCommentRepository ticketCommentRepository,
                         CurrentUserService currentUserService,
                         UserService userService,
                         FileStorageService fileStorageService,
                         NotificationService notificationService) {
        this.ticketRepository = ticketRepository;
        this.ticketCommentRepository = ticketCommentRepository;
        this.currentUserService = currentUserService;
        this.userService = userService;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
    }

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request, List<MultipartFile> files) {
        User actor = currentUserService.getCurrentUser();

        Ticket ticket = new Ticket();
        ticket.setTitle(request.getTitle().trim());
        ticket.setCategory(request.getCategory().trim());
        ticket.setDescription(request.getDescription().trim());
        ticket.setPriority(request.getPriority());
        ticket.setPreferredContactDetails(request.getPreferredContactDetails().trim());
        ticket.setCreatedBy(actor);

        Ticket savedTicket = ticketRepository.save(ticket);
        savedTicket.setAttachments(fileStorageService.storeTicketAttachments(savedTicket.getId(), files));

        return TicketingMapper.toTicketResponse(ticketRepository.save(savedTicket), List.of());
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getAccessibleTickets() {
        User actor = currentUserService.getCurrentUser();
        List<Ticket> tickets = actor.getRole() == Role.USER
                ? ticketRepository.findAllByCreatedByIdOrderByCreatedAtDesc(actor.getId())
                : ticketRepository.findAllByOrderByCreatedAtDesc();

        return tickets.stream()
                .map(ticket -> TicketingMapper.toTicketResponse(ticket, getCommentResponses(ticket, actor)))
                .toList();
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketById(Long ticketId) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);
        return TicketingMapper.toTicketResponse(ticket, getCommentResponses(ticket, actor));
    }

    @Transactional
    public TicketResponse updateStatus(Long ticketId, UpdateTicketStatusRequest request) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);
        validateTransition(ticket, request, actor);

        ticket.setStatus(request.getStatus());
        if (request.getStatus() == TicketStatus.RESOLVED && StringUtils.hasText(request.getResolutionNotes())) {
            ticket.setResolutionNotes(request.getResolutionNotes().trim());
        }
        if (request.getStatus() == TicketStatus.REJECTED) {
            ticket.setRejectionReason(request.getRejectionReason().trim());
        }
        if (request.getStatus() == TicketStatus.CLOSED) {
            ticket.setClosedAt(LocalDateTime.now());
        }

        Ticket savedTicket = ticketRepository.save(ticket);
        notificationService.notifyStatusChange(savedTicket,
                "Ticket #" + savedTicket.getId() + " is now " + savedTicket.getStatus(),
                actor);
        return TicketingMapper.toTicketResponse(savedTicket, getCommentResponses(savedTicket, actor));
    }

    @Transactional
    public TicketResponse assignTicket(Long ticketId, AssignTicketRequest request) {
        User actor = currentUserService.getCurrentUser();
        if (actor.getRole() != Role.ADMIN) {
            throw new AccessDeniedOperationException("Only admins can assign technicians");
        }

        Ticket ticket = findTicket(ticketId);
        User technician = userService.getTechnicianById(request.getTechnicianId());
        ticket.setAssignedTechnician(technician);
        Ticket savedTicket = ticketRepository.save(ticket);
        return TicketingMapper.toTicketResponse(savedTicket, getCommentResponses(savedTicket, actor));
    }

    @Transactional
    public CommentResponse addComment(Long ticketId, CreateCommentRequest request) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);

        TicketComment comment = new TicketComment();
        comment.setTicket(ticket);
        comment.setAuthor(actor);
        comment.setMessage(request.getMessage().trim());

        TicketComment savedComment = ticketCommentRepository.save(comment);
        notificationService.notifyCommentAdded(ticket,
                actor.getFullName() + " commented on ticket #" + ticket.getId(),
                actor);
        return TicketingMapper.toCommentResponse(savedComment, true);
    }

    @Transactional
    public CommentResponse updateComment(Long commentId, UpdateCommentRequest request) {
        User actor = currentUserService.getCurrentUser();
        TicketComment comment = findComment(commentId);
        assertCommentOwner(comment, actor);
        comment.setMessage(request.getMessage().trim());
        comment.setTimestamp(LocalDateTime.now());
        return TicketingMapper.toCommentResponse(ticketCommentRepository.save(comment), true);
    }

    @Transactional
    public void deleteComment(Long commentId) {
        User actor = currentUserService.getCurrentUser();
        TicketComment comment = findComment(commentId);
        assertCommentOwner(comment, actor);
        ticketCommentRepository.delete(comment);
    }

    public void assertCanDownloadAttachment(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, currentUserService.getCurrentUser());
    }

    private Ticket findTicket(Long ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket was not found"));
    }

    private TicketComment findComment(Long commentId) {
        return ticketCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment was not found"));
    }

    private List<CommentResponse> getCommentResponses(Ticket ticket, User actor) {
        return ticketCommentRepository.findAllByTicketIdOrderByTimestampAsc(ticket.getId())
                .stream()
                .map(comment -> TicketingMapper.toCommentResponse(comment, comment.getAuthor().getId().equals(actor.getId())))
                .toList();
    }

    private void assertTicketAccess(Ticket ticket, User actor) {
        if (actor.getRole() == Role.USER && !ticket.getCreatedBy().getId().equals(actor.getId())) {
            throw new AccessDeniedOperationException("You do not have access to this ticket");
        }
    }

    private void assertCommentOwner(TicketComment comment, User actor) {
        if (!comment.getAuthor().getId().equals(actor.getId())) {
            throw new AccessDeniedOperationException("Only the comment owner can modify this comment");
        }
    }

    private void validateTransition(Ticket ticket, UpdateTicketStatusRequest request, User actor) {
        TicketStatus currentStatus = ticket.getStatus();
        TicketStatus nextStatus = request.getStatus();

        if (!TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(nextStatus)) {
            throw new InvalidTicketTransitionException(
                    "Invalid status transition from " + currentStatus + " to " + nextStatus
            );
        }

        if (nextStatus == TicketStatus.REJECTED) {
            if (actor.getRole() != Role.ADMIN) {
                throw new AccessDeniedOperationException("Only admins can reject tickets");
            }
            if (!StringUtils.hasText(request.getRejectionReason())) {
                throw new InvalidTicketTransitionException("A rejection reason is required");
            }
            return;
        }

        if (nextStatus == TicketStatus.IN_PROGRESS || nextStatus == TicketStatus.RESOLVED) {
            boolean isAssignedTechnician = ticket.getAssignedTechnician() != null
                    && ticket.getAssignedTechnician().getId().equals(actor.getId());
            if (actor.getRole() != Role.ADMIN && !isAssignedTechnician) {
                throw new AccessDeniedOperationException(
                        "Only the assigned technician can move the ticket to " + nextStatus
                );
            }
            if (nextStatus == TicketStatus.RESOLVED && !StringUtils.hasText(request.getResolutionNotes())) {
                throw new InvalidTicketTransitionException("Resolution notes are required when resolving a ticket");
            }
            return;
        }

        if (nextStatus == TicketStatus.CLOSED) {
            boolean canClose = actor.getRole() == Role.ADMIN || ticket.getCreatedBy().getId().equals(actor.getId());
            if (!canClose) {
                throw new AccessDeniedOperationException("Only the ticket owner or an admin can close the ticket");
            }
        }
    }
}
