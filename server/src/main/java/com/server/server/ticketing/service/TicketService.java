package com.server.server.ticketing.service;

import com.server.server.exception.AccessDeniedOperationException;
import com.server.server.exception.InvalidTicketTransitionException;
import com.server.server.exception.ResourceNotFoundException;
import com.server.server.ticketing.dto.request.AssignTicketRequest;
import com.server.server.ticketing.dto.request.CreateCommentRequest;
import com.server.server.ticketing.dto.request.CreateTicketRequest;
import com.server.server.ticketing.dto.request.UpdateCommentRequest;
import com.server.server.ticketing.dto.request.UpdateTicketRequest;
import com.server.server.ticketing.dto.request.UpdateTicketStatusRequest;
import com.server.server.ticketing.dto.response.CommentResponse;
import com.server.server.ticketing.dto.response.TicketActivityResponse;
import com.server.server.ticketing.dto.response.TicketAnalyticsResponse;
import com.server.server.ticketing.dto.response.TicketResponse;
import com.server.server.ticketing.dto.response.TicketSummaryResponse;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketActivity;
import com.server.server.ticketing.entity.TicketComment;
import com.server.server.ticketing.entity.User;
import com.server.server.ticketing.enums.Role;
import com.server.server.ticketing.enums.TicketActivityAction;
import com.server.server.ticketing.enums.TicketPriority;
import com.server.server.ticketing.enums.TicketSeverity;
import com.server.server.ticketing.enums.TicketStatus;
import com.server.server.ticketing.mapper.TicketingMapper;
import com.server.server.ticketing.repository.TicketActivityRepository;
import com.server.server.ticketing.repository.TicketCommentRepository;
import com.server.server.ticketing.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class TicketService {

    private static final Map<TicketStatus, Set<TicketStatus>> TRANSITIONS = new EnumMap<>(TicketStatus.class);
    private static final List<TicketStatus> CLOSED_OR_DONE_STATUSES = List.of(TicketStatus.CLOSED, TicketStatus.RESOLVED, TicketStatus.REJECTED);

    static {
        TRANSITIONS.put(TicketStatus.OPEN, Set.of(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.ON_HOLD, TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.REJECTED));
        TRANSITIONS.put(TicketStatus.ASSIGNED, Set.of(TicketStatus.IN_PROGRESS, TicketStatus.ON_HOLD, TicketStatus.RESOLVED, TicketStatus.CLOSED));
        TRANSITIONS.put(TicketStatus.IN_PROGRESS, Set.of(TicketStatus.ON_HOLD, TicketStatus.RESOLVED));
        TRANSITIONS.put(TicketStatus.ON_HOLD, Set.of(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED));
        TRANSITIONS.put(TicketStatus.RESOLVED, Set.of(TicketStatus.CLOSED, TicketStatus.REOPENED));
        TRANSITIONS.put(TicketStatus.REOPENED, Set.of(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.ON_HOLD, TicketStatus.RESOLVED, TicketStatus.CLOSED));
        TRANSITIONS.put(TicketStatus.CLOSED, Set.of(TicketStatus.REOPENED));
        TRANSITIONS.put(TicketStatus.REJECTED, Set.of());
    }

    private final TicketRepository ticketRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final TicketActivityRepository ticketActivityRepository;
    private final CurrentUserService currentUserService;
    private final UserService userService;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;

    public TicketService(TicketRepository ticketRepository,
                         TicketCommentRepository ticketCommentRepository,
                         TicketActivityRepository ticketActivityRepository,
                         CurrentUserService currentUserService,
                         UserService userService,
                         FileStorageService fileStorageService,
                         NotificationService notificationService) {
        this.ticketRepository = ticketRepository;
        this.ticketCommentRepository = ticketCommentRepository;
        this.ticketActivityRepository = ticketActivityRepository;
        this.currentUserService = currentUserService;
        this.userService = userService;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
    }

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request, List<MultipartFile> files) {
        User actor = currentUserService.getCurrentUser();

        Ticket ticket = new Ticket();
        applyTicketFields(ticket, request);
        ticket.setCreatedBy(actor);

        Ticket savedTicket = ticketRepository.save(ticket);
        savedTicket.setTicketNumber(generateTicketNumber(savedTicket.getId()));
        savedTicket.setDueAt(calculateDueAt(savedTicket.getCreatedAt(), savedTicket.getPriority(), savedTicket.getSeverity()));
        savedTicket.setAttachments(fileStorageService.storeTicketAttachments(savedTicket.getId(), files));
        savedTicket = ticketRepository.save(savedTicket);

        recordActivity(
                savedTicket,
                actor,
                TicketActivityAction.TICKET_CREATED,
                "Ticket " + savedTicket.getTicketNumber() + " was created.",
                null,
                savedTicket.getStatus(),
                null,
                savedTicket.getAssignedTechnician(),
                false);
        notificationService.notifyTicketCreated(
                savedTicket,
                savedTicket.getTicketNumber() + " was created by " + actor.getFullName(),
                userService.getAdmins());

        return mapTicketResponse(savedTicket, actor);
    }

    @Transactional
    public TicketResponse updateTicket(Long ticketId, UpdateTicketRequest request) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertCanEditTicket(ticket, actor);

        applyTicketFields(ticket, request);
        ticket.setDueAt(calculateDueAt(ticket.getCreatedAt(), ticket.getPriority(), ticket.getSeverity()));
        Ticket savedTicket = ticketRepository.save(ticket);

        recordActivity(
                savedTicket,
                actor,
                TicketActivityAction.TICKET_UPDATED,
                "Ticket details were updated.",
                null,
                null,
                null,
                null,
                false);

        return mapTicketResponse(savedTicket, actor);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getAccessibleTickets() {
        User actor = currentUserService.getCurrentUser();
        List<Ticket> tickets = actor.getRole() == Role.USER
                ? ticketRepository.findAllByCreatedByIdAndArchivedFalseOrderByCreatedAtDesc(actor.getId())
                : ticketRepository.findAllByArchivedFalseOrderByCreatedAtDesc();

        return tickets.stream()
                .map(ticket -> mapTicketResponse(ticket, actor))
                .toList();
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketById(Long ticketId) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);
        return mapTicketResponse(ticket, actor);
    }

    @Transactional
    public TicketResponse updateStatus(Long ticketId, UpdateTicketStatusRequest request) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);
        validateTransition(ticket, request, actor);

        TicketStatus previousStatus = ticket.getStatus();
        ticket.setStatus(request.getStatus());
        if (request.getStatus() == TicketStatus.RESOLVED && StringUtils.hasText(request.getResolutionNotes())) {
            ticket.setResolutionNotes(request.getResolutionNotes().trim());
            ticket.setClosedAt(LocalDateTime.now());
        }
        if (request.getStatus() == TicketStatus.REJECTED && StringUtils.hasText(request.getRejectionReason())) {
            ticket.setRejectionReason(request.getRejectionReason().trim());
        }
        if (request.getStatus() == TicketStatus.CLOSED) {
            ticket.setClosedAt(LocalDateTime.now());
        }
        if (request.getStatus() == TicketStatus.REOPENED) {
            ticket.setClosedAt(null);
        }

        Ticket savedTicket = ticketRepository.save(ticket);
        recordActivity(
                savedTicket,
                actor,
                TicketActivityAction.STATUS_CHANGED,
                "Status changed from " + previousStatus + " to " + savedTicket.getStatus() + ".",
                previousStatus,
                savedTicket.getStatus(),
                savedTicket.getAssignedTechnician(),
                savedTicket.getAssignedTechnician(),
                false);
        notificationService.notifyStatusChange(savedTicket,
                savedTicket.getTicketNumber() + " is now " + savedTicket.getStatus(),
                actor);
        return mapTicketResponse(savedTicket, actor);
    }

    @Transactional
    public TicketResponse assignTicket(Long ticketId, AssignTicketRequest request) {
        User actor = currentUserService.getCurrentUser();
        if (actor.getRole() != Role.ADMIN) {
            throw new AccessDeniedOperationException("Only admins can assign technicians");
        }

        Ticket ticket = findTicket(ticketId);
        assertNotArchived(ticket);
        User previousAssignee = ticket.getAssignedTechnician();
        User technician = userService.getTechnicianById(request.getTechnicianId());
        ticket.setAssignedTechnician(technician);
        if (ticket.getStatus() == TicketStatus.OPEN || ticket.getStatus() == TicketStatus.REOPENED) {
            ticket.setStatus(TicketStatus.ASSIGNED);
        }
        Ticket savedTicket = ticketRepository.save(ticket);
        boolean reassigned = previousAssignee != null && !previousAssignee.getId().equals(technician.getId());
        recordActivity(
                savedTicket,
                actor,
                reassigned ? TicketActivityAction.TICKET_REASSIGNED : TicketActivityAction.TICKET_ASSIGNED,
                reassigned
                        ? "Ticket reassigned from " + previousAssignee.getFullName() + " to " + technician.getFullName() + "."
                        : "Ticket assigned to " + technician.getFullName() + ".",
                null,
                savedTicket.getStatus(),
                previousAssignee,
                technician,
                false);
        notificationService.notifyTicketAssigned(
                savedTicket,
                savedTicket.getTicketNumber() + " was assigned to you.",
                actor);
        return mapTicketResponse(savedTicket, actor);
    }

    @Transactional
    public TicketResponse archiveTicket(Long ticketId) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);

        boolean canArchive = actor.getRole() == Role.ADMIN || ticket.getCreatedBy().getId().equals(actor.getId());
        if (!canArchive) {
            throw new AccessDeniedOperationException("You do not have permission to archive this ticket");
        }

        ticket.setArchived(true);
        ticket.setArchivedAt(LocalDateTime.now());
        Ticket savedTicket = ticketRepository.save(ticket);
        recordActivity(
                savedTicket,
                actor,
                TicketActivityAction.TICKET_ARCHIVED,
                "Ticket was archived.",
                null,
                null,
                savedTicket.getAssignedTechnician(),
                savedTicket.getAssignedTechnician(),
                false);
        return mapTicketResponse(savedTicket, actor);
    }

    @Transactional
    public CommentResponse addComment(Long ticketId, CreateCommentRequest request) {
        User actor = currentUserService.getCurrentUser();
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, actor);
        assertNotArchived(ticket);

        if (request.isInternalNote() && actor.getRole() == Role.USER) {
            throw new AccessDeniedOperationException("Only staff can add internal notes");
        }

        TicketComment comment = new TicketComment();
        comment.setTicket(ticket);
        comment.setAuthor(actor);
        comment.setMessage(request.getMessage().trim());
        comment.setInternalNote(request.isInternalNote());

        TicketComment savedComment = ticketCommentRepository.save(comment);
        recordActivity(
                ticket,
                actor,
                request.isInternalNote() ? TicketActivityAction.INTERNAL_NOTE_ADDED : TicketActivityAction.COMMENT_ADDED,
                request.isInternalNote() ? "An internal note was added." : "A comment was added.",
                null,
                null,
                ticket.getAssignedTechnician(),
                ticket.getAssignedTechnician(),
                request.isInternalNote());
        notificationService.notifyCommentAdded(ticket,
                actor.getFullName() + " commented on " + ticket.getTicketNumber(),
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
        TicketComment savedComment = ticketCommentRepository.save(comment);
        recordActivity(
                comment.getTicket(),
                actor,
                TicketActivityAction.COMMENT_UPDATED,
                comment.isInternalNote() ? "An internal note was updated." : "A comment was updated.",
                null,
                null,
                comment.getTicket().getAssignedTechnician(),
                comment.getTicket().getAssignedTechnician(),
                comment.isInternalNote());
        return TicketingMapper.toCommentResponse(savedComment, true);
    }

    @Transactional
    public void deleteComment(Long commentId) {
        User actor = currentUserService.getCurrentUser();
        TicketComment comment = findComment(commentId);
        assertCommentOwner(comment, actor);
        recordActivity(
                comment.getTicket(),
                actor,
                TicketActivityAction.COMMENT_DELETED,
                comment.isInternalNote() ? "An internal note was deleted." : "A comment was deleted.",
                null,
                null,
                comment.getTicket().getAssignedTechnician(),
                comment.getTicket().getAssignedTechnician(),
                comment.isInternalNote());
        ticketCommentRepository.delete(comment);
    }

    @Transactional(readOnly = true)
    public TicketSummaryResponse getSummary() {
        User actor = currentUserService.getCurrentUser();
        List<Ticket> tickets = getActiveTicketsForActor(actor);

        return new TicketSummaryResponse(
                tickets.size(),
                countByStatus(tickets, TicketStatus.OPEN, TicketStatus.REOPENED),
                countByStatus(tickets, TicketStatus.ASSIGNED),
                countByStatus(tickets, TicketStatus.IN_PROGRESS, TicketStatus.ON_HOLD),
                tickets.stream().filter(this::isOverdue).count(),
                countByStatus(tickets, TicketStatus.RESOLVED),
                countByStatus(tickets, TicketStatus.CLOSED)
        );
    }

    @Transactional(readOnly = true)
    public TicketAnalyticsResponse getAnalytics() {
        User actor = currentUserService.getCurrentUser();
        List<Ticket> tickets = getActiveTicketsForActor(actor);
        LocalDate now = LocalDate.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM");

        Map<String, Long> monthlyCounts = tickets.stream()
                .collect(LinkedHashMap::new,
                        (map, ticket) -> map.merge(YearMonth.from(ticket.getCreatedAt()).format(formatter), 1L, Long::sum),
                        LinkedHashMap::putAll);
        Map<String, Long> typeBreakdown = countByKey(tickets, ticket -> ticket.getType().name());
        Map<String, Long> categoryBreakdown = countByKey(tickets, Ticket::getCategory);
        Map<String, Long> priorityBreakdown = countByKey(tickets, ticket -> ticket.getPriority().name());
        Map<String, Long> statusBreakdown = countByKey(tickets, ticket -> ticket.getStatus().name());
        Map<String, Long> technicianWorkload = tickets.stream()
                .filter(ticket -> ticket.getAssignedTechnician() != null)
                .collect(LinkedHashMap::new,
                        (map, ticket) -> map.merge(ticket.getAssignedTechnician().getFullName(), 1L, Long::sum),
                        LinkedHashMap::putAll);

        double averageResolutionHours = tickets.stream()
                .filter(ticket -> ticket.getClosedAt() != null)
                .mapToLong(ticket -> Duration.between(ticket.getCreatedAt(), ticket.getClosedAt()).toHours())
                .average()
                .orElse(0);

        if (monthlyCounts.isEmpty()) {
            for (int index = 5; index >= 0; index--) {
                monthlyCounts.put(YearMonth.from(now.minusMonths(index)).format(formatter), 0L);
            }
        }

        return new TicketAnalyticsResponse(
                monthlyCounts,
                typeBreakdown,
                categoryBreakdown,
                priorityBreakdown,
                statusBreakdown,
                averageResolutionHours,
                tickets.stream().filter(this::isOverdue).count(),
                technicianWorkload
        );
    }

    public void assertCanDownloadAttachment(Long ticketId) {
        Ticket ticket = findTicket(ticketId);
        assertTicketAccess(ticket, currentUserService.getCurrentUser());
    }

    private List<Ticket> getActiveTicketsForActor(User actor) {
        return actor.getRole() == Role.USER
                ? ticketRepository.findAllByCreatedByIdAndArchivedFalseOrderByCreatedAtDesc(actor.getId())
                : ticketRepository.findAllByArchivedFalseOrderByCreatedAtDesc();
    }

    private TicketResponse mapTicketResponse(Ticket ticket, User actor) {
        return TicketingMapper.toTicketResponse(
                ticket,
                getCommentResponses(ticket, actor),
                getActivityResponses(ticket, actor));
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
                .filter(comment -> actor.getRole() != Role.USER || !comment.isInternalNote())
                .map(comment -> TicketingMapper.toCommentResponse(comment, comment.getAuthor().getId().equals(actor.getId())))
                .toList();
    }

    private List<TicketActivityResponse> getActivityResponses(Ticket ticket, User actor) {
        return ticketActivityRepository.findAllByTicketIdOrderByCreatedAtAsc(ticket.getId())
                .stream()
                .filter(activity -> actor.getRole() != Role.USER || !activity.isInternalOnly())
                .map(TicketingMapper::toActivityResponse)
                .toList();
    }

    private void assertTicketAccess(Ticket ticket, User actor) {
        if (actor.getRole() == Role.USER && !ticket.getCreatedBy().getId().equals(actor.getId())) {
            throw new AccessDeniedOperationException("You do not have access to this ticket");
        }
    }

    private void assertCanEditTicket(Ticket ticket, User actor) {
        assertTicketAccess(ticket, actor);
        assertNotArchived(ticket);

        boolean editableByOwner = ticket.getCreatedBy().getId().equals(actor.getId())
                && List.of(TicketStatus.OPEN, TicketStatus.REOPENED, TicketStatus.ON_HOLD, TicketStatus.ASSIGNED).contains(ticket.getStatus());

        if (actor.getRole() == Role.ADMIN || editableByOwner) {
            return;
        }

        throw new AccessDeniedOperationException("Only admins or the requester can edit this ticket while it is still active");
    }

    private void assertCommentOwner(TicketComment comment, User actor) {
        if (!comment.getAuthor().getId().equals(actor.getId())) {
            throw new AccessDeniedOperationException("Only the comment owner can modify this comment");
        }
    }

    private void assertNotArchived(Ticket ticket) {
        if (ticket.isArchived()) {
            throw new InvalidTicketTransitionException("Archived tickets cannot be modified");
        }
    }

    private void validateTransition(Ticket ticket, UpdateTicketStatusRequest request, User actor) {
        assertNotArchived(ticket);
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

        if (nextStatus == TicketStatus.ASSIGNED) {
            if (ticket.getAssignedTechnician() == null && actor.getRole() != Role.ADMIN) {
                throw new AccessDeniedOperationException("A technician must be assigned before using the ASSIGNED status");
            }
            return;
        }

        if (nextStatus == TicketStatus.IN_PROGRESS || nextStatus == TicketStatus.ON_HOLD || nextStatus == TicketStatus.RESOLVED) {
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

        if (nextStatus == TicketStatus.REOPENED) {
            boolean canReopen = actor.getRole() == Role.ADMIN || ticket.getCreatedBy().getId().equals(actor.getId());
            if (!canReopen) {
                throw new AccessDeniedOperationException("Only the ticket owner or an admin can reopen the ticket");
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

    private void applyTicketFields(Ticket ticket, CreateTicketRequest request) {
        ticket.setTitle(request.getTitle().trim());
        ticket.setType(request.getType());
        ticket.setCategory(request.getCategory().trim());
        ticket.setSubcategory(normalize(request.getSubcategory()));
        ticket.setDescription(request.getDescription().trim());
        ticket.setPriority(request.getPriority());
        ticket.setSeverity(request.getSeverity());
        ticket.setLocation(normalize(request.getLocation()));
        ticket.setBuilding(normalize(request.getBuilding()));
        ticket.setDepartment(normalize(request.getDepartment()));
        ticket.setPreferredContactDetails(request.getPreferredContactDetails().trim());
    }

    private void applyTicketFields(Ticket ticket, UpdateTicketRequest request) {
        ticket.setTitle(request.getTitle().trim());
        ticket.setType(request.getType());
        ticket.setCategory(request.getCategory().trim());
        ticket.setSubcategory(normalize(request.getSubcategory()));
        ticket.setDescription(request.getDescription().trim());
        ticket.setPriority(request.getPriority());
        ticket.setSeverity(request.getSeverity());
        ticket.setLocation(normalize(request.getLocation()));
        ticket.setBuilding(normalize(request.getBuilding()));
        ticket.setDepartment(normalize(request.getDepartment()));
        ticket.setPreferredContactDetails(request.getPreferredContactDetails().trim());
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private void recordActivity(Ticket ticket,
                                User actor,
                                TicketActivityAction action,
                                String message,
                                TicketStatus fromStatus,
                                TicketStatus toStatus,
                                User previousAssignee,
                                User newAssignee,
                                boolean internalOnly) {
        TicketActivity activity = new TicketActivity();
        activity.setTicket(ticket);
        activity.setActor(actor);
        activity.setAction(action);
        activity.setMessage(message);
        activity.setFromStatus(fromStatus == null ? null : fromStatus.name());
        activity.setToStatus(toStatus == null ? null : toStatus.name());
        activity.setPreviousAssigneeName(previousAssignee == null ? null : previousAssignee.getFullName());
        activity.setNewAssigneeName(newAssignee == null ? null : newAssignee.getFullName());
        activity.setInternalOnly(internalOnly);
        ticketActivityRepository.save(activity);
    }

    private String generateTicketNumber(Long id) {
        return "TKT-" + String.format("%06d", id);
    }

    private LocalDateTime calculateDueAt(LocalDateTime createdAt, TicketPriority priority, TicketSeverity severity) {
        LocalDateTime base = createdAt == null ? LocalDateTime.now() : createdAt;
        int hours = switch (severity) {
            case CRITICAL -> 4;
            case HIGH -> priority == TicketPriority.HIGH ? 12 : 24;
            case MEDIUM -> 48;
            case LOW -> 96;
        };
        return base.plusHours(hours);
    }

    private boolean isOverdue(Ticket ticket) {
        return !ticket.isArchived()
                && ticket.getDueAt() != null
                && LocalDateTime.now().isAfter(ticket.getDueAt())
                && !CLOSED_OR_DONE_STATUSES.contains(ticket.getStatus());
    }

    private long countByStatus(List<Ticket> tickets, TicketStatus... statuses) {
        Set<TicketStatus> expected = Set.of(statuses);
        return tickets.stream().filter(ticket -> expected.contains(ticket.getStatus())).count();
    }

    private Map<String, Long> countByKey(List<Ticket> tickets, java.util.function.Function<Ticket, String> keyExtractor) {
        return tickets.stream()
                .sorted(Comparator.comparing(Ticket::getCreatedAt))
                .collect(LinkedHashMap::new,
                        (map, ticket) -> map.merge(keyExtractor.apply(ticket), 1L, Long::sum),
                        LinkedHashMap::putAll);
    }
}
