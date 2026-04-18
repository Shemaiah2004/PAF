package com.server.server.ticketing.service;

import com.server.server.auth.entity.User;
import com.server.server.auth.entity.UserRole;
import com.server.server.auth.exception.ForbiddenAccessException;
import com.server.server.auth.repository.UserRepository;
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
import com.server.server.ticketing.exception.InvalidTicketWorkflowException;
import com.server.server.ticketing.exception.TicketNotFoundException;
import com.server.server.ticketing.repository.TicketRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TicketServiceImpl implements TicketService {

    private static final List<String> STUDENT_TICKET_CATEGORIES = List.of(
            "Air Conditioning",
            "Electricity / Lighting",
            "Water / Plumbing",
            "Internet / Wi-Fi",
            "Classroom Equipment",
            "Access / Security",
            "Cleaning / Housekeeping",
            "Furniture / Facility Damage",
            "Other");

    private static final Map<String, String> LEGACY_CATEGORY_MAP = Map.of(
            "HVAC", "Air Conditioning",
            "Electrical", "Electricity / Lighting",
            "Plumbing", "Water / Plumbing",
            "Networking", "Internet / Wi-Fi",
            "AV Equipment", "Classroom Equipment",
            "Access Control", "Access / Security",
            "Security", "Access / Security",
            "Cleaning", "Cleaning / Housekeeping");

    private static final List<TicketStatus> DASHBOARD_STATUS_ORDER = List.of(
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.ON_HOLD,
            TicketStatus.RESOLVED,
            TicketStatus.CLOSED,
            TicketStatus.CANCELLED);

    private static final List<TicketPriority> DASHBOARD_PRIORITY_ORDER = List.of(
            TicketPriority.LOW,
            TicketPriority.MEDIUM,
            TicketPriority.HIGH,
            TicketPriority.CRITICAL);

    private static final DateTimeFormatter MONTH_LABEL_FORMATTER =
            DateTimeFormatter.ofPattern("MMM uuuu", Locale.ENGLISH).withZone(ZoneId.systemDefault());

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;

    public TicketServiceImpl(TicketRepository ticketRepository, UserRepository userRepository) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
    }

    @Override
    public TicketMetaResponse getMeta() {
        List<Ticket.UserSummary> technicians = userRepository.findAll().stream()
                .filter(this::isStaffUser)
                .sorted(Comparator.comparing(user -> safeLower(resolveDisplayName(user))))
                .map(this::toUserSummary)
                .toList();

        return new TicketMetaResponse(
                List.of(TicketType.values()),
                List.of(TicketPriority.values()),
                List.of(TicketStatus.values()),
                STUDENT_TICKET_CATEGORIES,
                technicians);
    }

    @Override
    public TicketListResponse getTickets(
            String userId,
            String search,
            TicketType type,
            TicketPriority priority,
            TicketStatus status,
            String category,
            String location,
            String assignedTechnicianId,
            boolean overdueOnly) {
        User actor = getRequiredUser(userId);
        List<Ticket> scopedTickets = getScopedTickets(actor).stream()
                .filter(ticket -> matchesSearch(ticket, search))
                .filter(ticket -> type == null || ticket.getType() == type)
                .filter(ticket -> priority == null || ticket.getPriority() == priority)
                .filter(ticket -> status == null || ticket.getStatus() == status)
                .filter(ticket -> category == null || category.isBlank() || ticket.getCategory().equals(category))
                .filter(ticket -> matchesLocation(ticket, location))
                .filter(ticket -> assignedTechnicianId == null
                        || assignedTechnicianId.isBlank()
                        || (ticket.getAssignedTechnician() != null
                        && assignedTechnicianId.equals(ticket.getAssignedTechnician().getId())))
                .filter(ticket -> !overdueOnly || isTicketOverdue(ticket))
                .sorted(Comparator.comparing(Ticket::getCreatedAt).reversed())
                .toList();

        return new TicketListResponse(scopedTickets, new TicketListResponse.Pagination(scopedTickets.size()));
    }

    @Override
    public Ticket getTicketById(String ticketId, String userId) {
        User actor = getRequiredUser(userId);
        Ticket ticket = getRequiredTicket(ticketId);
        assertCanViewTicket(actor, ticket);
        refreshComputedFields(ticket);
        return ticketRepository.save(ticket);
    }

    @Override
    public Ticket createTicket(CreateTicketRequest request, String userId) {
        User actor = getRequiredUser(userId);
        Instant now = Instant.now();
        Ticket ticket = new Ticket();
        ticket.setTicketId(generateTicketId());
        ticket.setTitle(request.title().trim());
        ticket.setDescription(request.description().trim());
        ticket.setType(request.type());
        ticket.setPriority(request.priority());
        ticket.setCategory(normalizeTicketCategory(request.category()));
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setLocation(toLocation(request.location(), request.type()));
        ticket.setReporter(toUserSummary(actor));
        ticket.setAssignedTechnician(null);
        ticket.setRequiresExtendedResolution(Boolean.TRUE.equals(request.requiresExtendedResolution()));
        ticket.setAttachments(new ArrayList<>());
        ticket.setComments(new ArrayList<>());
        ticket.setActivity(new ArrayList<>(List.of(activity(
                "TICKET_CREATED",
                "Ticket created with " + request.priority() + " priority.",
                now,
                actor))));
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        refreshComputedFields(ticket);
        return ticketRepository.save(ticket);
    }

    @Override
    public Ticket updateTicket(String ticketId, UpdateTicketRequest request, String userId) {
        User actor = getRequiredUser(userId);
        assertCanManageWorkflow(actor);

        Ticket ticket = getRequiredTicket(ticketId);
        assertCanViewTicket(actor, ticket);

        Instant now = Instant.now();
        TicketStatus previousStatus = ticket.getStatus();
        TicketPriority previousPriority = ticket.getPriority();
        boolean previousExtended = ticket.isRequiresExtendedResolution();
        String previousTechnicianId = ticket.getAssignedTechnician() != null
                ? ticket.getAssignedTechnician().getId()
                : null;

        TicketPriority nextPriority = request.priority() != null ? request.priority() : ticket.getPriority();
        boolean nextExtended = request.requiresExtendedResolution() != null
                ? request.requiresExtendedResolution()
                : ticket.isRequiresExtendedResolution();
        TicketStatus nextStatus = request.status() != null ? request.status() : ticket.getStatus();

        if (request.status() != null
                && !getAllowedStatusOptions(previousStatus, nextPriority, nextExtended).contains(request.status())) {
            String allowedStatuses = getAllowedStatusOptions(previousStatus, nextPriority, nextExtended).stream()
                    .map(status -> status.name().replace("_", " "))
                    .collect(Collectors.joining(", "));

            throw new InvalidTicketWorkflowException(
                    "This ticket cannot move from "
                            + previousStatus.name().replace("_", " ")
                            + " to "
                            + request.status().name().replace("_", " ")
                            + ". Allowed next stages: "
                            + allowedStatuses
                            + ".");
        }

        if (request.description() != null) {
            ticket.setDescription(request.description().trim());
        }
        if (request.category() != null && !request.category().isBlank()) {
            ticket.setCategory(normalizeTicketCategory(request.category()));
        }
        if (request.location() != null) {
            ticket.setLocation(toLocation(request.location(), ticket.getType()));
        }
        ticket.setPriority(nextPriority);
        ticket.setRequiresExtendedResolution(nextExtended);
        ticket.setStatus(nextStatus);

        if (request.assignedTechnicianId() != null) {
            ticket.setAssignedTechnician(resolveTechnicianSummary(request.assignedTechnicianId()));
        }

        if (request.status() != null && request.status() == TicketStatus.RESOLVED && previousStatus != TicketStatus.RESOLVED) {
            ticket.setResolvedAt(now);
        }

        if (request.status() != null && request.status() == TicketStatus.CLOSED && previousStatus != TicketStatus.CLOSED) {
            ticket.setClosedAt(now);
        }

        if (request.status() != null && request.status() != TicketStatus.RESOLVED && request.status() != TicketStatus.CLOSED) {
            ticket.setClosedAt(null);
            if (request.status() != TicketStatus.RESOLVED) {
                ticket.setResolvedAt(null);
            }
        }

        List<Ticket.ActivityItem> nextActivity = new ArrayList<>();
        String nextTechnicianId = ticket.getAssignedTechnician() != null ? ticket.getAssignedTechnician().getId() : null;
        if (!safeEquals(previousTechnicianId, nextTechnicianId)) {
            if (ticket.getAssignedTechnician() == null) {
                nextActivity.add(activity("TECHNICIAN_UNASSIGNED", "Technician assignment was cleared.", now, actor));
            } else {
                nextActivity.add(activity(
                        "TECHNICIAN_ASSIGNED",
                        ticket.getAssignedTechnician().getFullName() + " was assigned to the ticket.",
                        now,
                        actor));
            }
        }

        if (request.requiresExtendedResolution() != null && previousExtended != nextExtended) {
            nextActivity.add(activity(
                    "SLA_UPDATED",
                    nextExtended
                            ? "Extended resolution time enabled for a major or large repair."
                            : "Ticket moved back to the standard SLA window.",
                    now,
                    actor));
        }

        if (request.status() != null && previousStatus != request.status()) {
            nextActivity.add(activity(
                    "STATUS_CHANGED",
                    "Ticket moved to " + request.status().name().replace("_", " ") + ".",
                    now,
                    actor));
        } else if ((request.priority() != null
                && previousPriority != request.priority())
                || request.description() != null
                || request.category() != null
                || request.location() != null) {
            nextActivity.add(activity("TICKET_UPDATED", "Ticket updated.", now, actor));
        }

        ticket.setUpdatedAt(now);
        refreshComputedFields(ticket);
        ticket.getActivity().addAll(0, nextActivity);
        return ticketRepository.save(ticket);
    }

    @Override
    public Ticket assignTechnician(String ticketId, String technicianId, String userId) {
        User actor = getRequiredUser(userId);
        assertIsAdmin(actor);

        Ticket ticket = getRequiredTicket(ticketId);
        assertCanViewTicket(actor, ticket);

        Instant now = Instant.now();
        ticket.setAssignedTechnician(resolveTechnicianSummary(technicianId));
        if (ticket.getAssignedTechnician() != null) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        ticket.setUpdatedAt(now);
        refreshComputedFields(ticket);
        ticket.getActivity().add(0, activity(
                ticket.getAssignedTechnician() == null ? "TECHNICIAN_UNASSIGNED" : "TECHNICIAN_ASSIGNED",
                ticket.getAssignedTechnician() == null
                        ? "Technician assignment was cleared."
                        : ticket.getAssignedTechnician().getFullName() + " was assigned to the ticket.",
                now,
                actor));
        return ticketRepository.save(ticket);
    }

    @Override
    public Ticket addComment(String ticketId, String message, String userId) {
        User actor = getRequiredUser(userId);
        Ticket ticket = getRequiredTicket(ticketId);
        assertCanComment(actor, ticket);

        Instant now = Instant.now();
        Ticket.Comment comment = new Ticket.Comment();
        comment.setId(UUID.randomUUID().toString());
        comment.setMessage(message.trim());
        comment.setCreatedAt(now);
        comment.setAuthor(toActorSummary(actor));

        ticket.getComments().add(comment);
        ticket.getActivity().add(0, activity("COMMENT_ADDED", "Comment added.", now, actor));
        ticket.setUpdatedAt(now);
        return ticketRepository.save(ticket);
    }

    @Override
    public Ticket addAttachments(String ticketId, List<MultipartFile> files, String userId) {
        User actor = getRequiredUser(userId);
        Ticket ticket = getRequiredTicket(ticketId);
        assertCanComment(actor, ticket);

        if (files == null || files.isEmpty()) {
            return ticket;
        }

        Instant uploadedAt = Instant.now();
        List<Ticket.Attachment> newAttachments = files.stream()
                .map(file -> toAttachment(file, actor, uploadedAt))
                .toList();

        ticket.getAttachments().addAll(newAttachments);
        ticket.getActivity().add(0, activity(
                "ATTACHMENT_UPLOADED",
                newAttachments.size() + " attachment(s) uploaded.",
                uploadedAt,
                actor));
        ticket.setUpdatedAt(uploadedAt);
        return ticketRepository.save(ticket);
    }

    @Override
    public TicketDashboardResponse getDashboard(String userId) {
        User actor = getRequiredUser(userId);
        List<Ticket> tickets = getScopedTickets(actor).stream()
                .map(this::refreshComputedFields)
                .sorted(Comparator.comparing(Ticket::getCreatedAt).reversed())
                .toList();

        Map<TicketStatus, Long> statusCounts = new EnumMap<>(TicketStatus.class);
        Map<TicketPriority, Long> priorityCounts = new EnumMap<>(TicketPriority.class);
        Map<TicketType, Long> typeCounts = new EnumMap<>(TicketType.class);
        Map<String, Long> slaBucketCounts = Map.of(
                "Same-day target", tickets.stream().filter(ticket -> ticket.getSlaHours() == 12).count(),
                "2-day target", tickets.stream().filter(ticket -> ticket.getSlaHours() == 48).count(),
                "Extended repair window", tickets.stream().filter(ticket -> ticket.getSlaHours() == 72).count());
        Map<String, Long> monthlyCounts = tickets.stream().collect(Collectors.groupingBy(
                ticket -> MONTH_LABEL_FORMATTER.format(ticket.getCreatedAt()),
                Collectors.counting()));

        for (Ticket ticket : tickets) {
            statusCounts.merge(ticket.getStatus(), 1L, Long::sum);
            priorityCounts.merge(ticket.getPriority(), 1L, Long::sum);
            typeCounts.merge(ticket.getType(), 1L, Long::sum);
        }

        long resolvedCount = tickets.stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.RESOLVED || ticket.getStatus() == TicketStatus.CLOSED)
                .count();

        List<TicketDashboardResponse.SlaBucket> slaBuckets = List.of(
                new TicketDashboardResponse.SlaBucket(
                        "Same-day target",
                        slaBucketCounts.get("Same-day target"),
                        "Low and medium priority tickets expected to close within the day."),
                new TicketDashboardResponse.SlaBucket(
                        "2-day target",
                        slaBucketCounts.get("2-day target"),
                        "High and critical tickets that can take up to around 2 days."),
                new TicketDashboardResponse.SlaBucket(
                        "Extended repair window",
                        slaBucketCounts.get("Extended repair window"),
                        "Major or large repairs intentionally given extra time."));

        return new TicketDashboardResponse(
                new TicketDashboardResponse.Cards(
                        tickets.size(),
                        tickets.stream().filter(this::isOpenWork).count(),
                        tickets.stream().filter(this::isTicketOverdue).count(),
                        tickets.isEmpty() ? 0 : Math.round((resolvedCount * 100.0f) / tickets.size())),
                slaBuckets,
                new TicketDashboardResponse.Charts(
                        DASHBOARD_STATUS_ORDER.stream()
                                .map(status -> new TicketDashboardResponse.CountBucket(status.name(), statusCounts.getOrDefault(status, 0L)))
                                .toList(),
                        DASHBOARD_PRIORITY_ORDER.stream()
                                .map(priority -> new TicketDashboardResponse.CountBucket(priority.name(), priorityCounts.getOrDefault(priority, 0L)))
                                .toList(),
                        List.of(TicketType.MAINTENANCE, TicketType.INCIDENT).stream()
                                .map(type -> new TicketDashboardResponse.CountBucket(type.name(), typeCounts.getOrDefault(type, 0L)))
                                .toList(),
                        getLastSixMonthLabels().stream()
                                .map(label -> new TicketDashboardResponse.MonthlyTrendPoint(label, monthlyCounts.getOrDefault(label, 0L)))
                                .toList()),
                tickets.stream().limit(5).toList());
    }

    @Override
    public TicketReportsResponse getReports(String userId) {
        User actor = getRequiredUser(userId);
        assertCanManageWorkflow(actor);

        List<Ticket> tickets = getScopedTickets(actor).stream()
                .map(this::refreshComputedFields)
                .toList();

        Map<String, Long> categoryCounts = tickets.stream().collect(Collectors.groupingBy(Ticket::getCategory, Collectors.counting()));
        Map<String, Long> technicianCounts = tickets.stream().collect(Collectors.groupingBy(
                ticket -> ticket.getAssignedTechnician() != null ? ticket.getAssignedTechnician().getFullName() : "Unassigned",
                Collectors.counting()));
        Map<String, Long> typeCounts = tickets.stream().collect(Collectors.groupingBy(
                ticket -> ticket.getType().name(),
                Collectors.counting()));

        List<Ticket> closedTickets = tickets.stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.RESOLVED || ticket.getStatus() == TicketStatus.CLOSED)
                .toList();

        long slaBreachedTickets = closedTickets.stream()
                .filter(ticket -> resolveCompletedAt(ticket).isAfter(ticket.getDueAt()))
                .count();
        long slaMetTickets = closedTickets.size() - slaBreachedTickets;
        long averageResolutionHours = closedTickets.isEmpty()
                ? 0
                : Math.round((float) closedTickets.stream()
                        .mapToLong(ticket -> (resolveCompletedAt(ticket).toEpochMilli() - ticket.getCreatedAt().toEpochMilli()) / (1000 * 60 * 60))
                        .average()
                        .orElse(0));

        return new TicketReportsResponse(
                new TicketReportsResponse.Summary(averageResolutionHours, slaBreachedTickets, slaMetTickets),
                toCountBuckets(categoryCounts),
                toCountBuckets(technicianCounts),
                toCountBuckets(typeCounts));
    }

    private User getRequiredUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ForbiddenAccessException("You must be signed in to access this resource."));
    }

    private Ticket getRequiredTicket(String ticketId) {
        return ticketRepository.findById(ticketId)
                .orElseThrow(() -> new TicketNotFoundException("Ticket not found."));
    }

    private List<Ticket> getScopedTickets(User actor) {
        return ticketRepository.findAll().stream()
                .map(this::refreshComputedFields)
                .filter(ticket -> canViewTicket(actor, ticket))
                .sorted(Comparator.comparing(Ticket::getCreatedAt).reversed())
                .toList();
    }

    private void assertCanViewTicket(User actor, Ticket ticket) {
        if (!canViewTicket(actor, ticket)) {
            throw new ForbiddenAccessException("You do not have access to this ticket.");
        }
    }

    private boolean canViewTicket(User actor, Ticket ticket) {
        return isStaffUser(actor) || actor.getId().equals(ticket.getReporter().getId());
    }

    private void assertCanComment(User actor, Ticket ticket) {
        if (isStaffUser(actor) || actor.getId().equals(ticket.getReporter().getId())) {
            return;
        }

        throw new ForbiddenAccessException("You do not have access to update this ticket.");
    }

    private void assertCanManageWorkflow(User actor) {
        if (actor.getRole() == UserRole.ADMIN || actor.getRole() == UserRole.TECHNICIAN) {
            return;
        }

        throw new ForbiddenAccessException("Only technicians and admins can update ticket workflow.");
    }

    private void assertIsAdmin(User actor) {
        if (actor.getRole() == UserRole.ADMIN) {
            return;
        }

        throw new ForbiddenAccessException("Only admins can assign technicians.");
    }

    private boolean isStaffUser(User user) {
        return user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.TECHNICIAN;
    }

    private Ticket.UserSummary resolveTechnicianSummary(String technicianId) {
        if (technicianId == null || technicianId.isBlank()) {
            return null;
        }

        User technician = userRepository.findById(technicianId)
                .orElseThrow(() -> new TicketNotFoundException("Technician not found."));

        if (!isStaffUser(technician)) {
            throw new ForbiddenAccessException("Assigned user must be an admin or technician.");
        }

        return toActorSummary(technician);
    }

    private Ticket.Location toLocation(CreateTicketRequest.TicketLocationRequest request, TicketType type) {
        Ticket.Location location = new Ticket.Location();
        location.setBuilding(request.building().trim());
        location.setFloor(trimToNull(request.floor()));
        location.setRoom(trimToNull(request.room()));
        location.setCampus(trimToNull(request.campus()));
        location.setNote(type == TicketType.INCIDENT ? trimToNull(request.note()) : null);
        return location;
    }

    private Ticket.UserSummary toUserSummary(User user) {
        Ticket.UserSummary summary = toActorSummary(user);
        summary.setEmail(user.getEmail());
        return summary;
    }

    private Ticket.UserSummary toActorSummary(User user) {
        Ticket.UserSummary summary = new Ticket.UserSummary();
        summary.setId(user.getId());
        summary.setFullName(resolveDisplayName(user));
        summary.setRole(user.getRole() != null ? user.getRole() : UserRole.USER);
        return summary;
    }

    private Ticket.Attachment toAttachment(MultipartFile file, User actor, Instant uploadedAt) {
        String originalName = file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                ? file.getOriginalFilename()
                : "attachment";
        Ticket.Attachment attachment = new Ticket.Attachment();
        attachment.setId(UUID.randomUUID().toString());
        attachment.setFileName(slugifyFileName(originalName));
        attachment.setOriginalName(originalName);
        attachment.setMimeType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        attachment.setSize(file.getSize());
        attachment.setUrl("#");
        attachment.setUploadedAt(uploadedAt);
        attachment.setUploadedBy(toActorSummary(actor));
        return attachment;
    }

    private Ticket.ActivityItem activity(String action, String message, Instant timestamp, User actor) {
        Ticket.ActivityItem item = new Ticket.ActivityItem();
        item.setId(UUID.randomUUID().toString());
        item.setAction(action);
        item.setMessage(message);
        item.setCreatedAt(timestamp);
        item.setActor(toActorSummary(actor));
        return item;
    }

    private Ticket refreshComputedFields(Ticket ticket) {
        if (ticket.getAttachments() == null) {
            ticket.setAttachments(new ArrayList<>());
        }
        if (ticket.getComments() == null) {
            ticket.setComments(new ArrayList<>());
        }
        if (ticket.getActivity() == null) {
            ticket.setActivity(new ArrayList<>());
        }
        int slaHours = getSlaHours(ticket.getPriority(), ticket.isRequiresExtendedResolution());
        Instant dueAt = ticket.getCreatedAt().plusSeconds(slaHours * 60L * 60L);
        ticket.setSlaHours(slaHours);
        ticket.setDueAt(dueAt);
        ticket.setOverdue(isTicketOverdue(ticket));
        return ticket;
    }

    private int getSlaHours(TicketPriority priority, boolean requiresExtendedResolution) {
        if (requiresExtendedResolution) {
            return 72;
        }
        if (priority == TicketPriority.HIGH || priority == TicketPriority.CRITICAL) {
            return 48;
        }
        return 12;
    }

    private boolean isTicketOverdue(Ticket ticket) {
        return ticket.getStatus() != TicketStatus.RESOLVED
                && ticket.getStatus() != TicketStatus.CLOSED
                && ticket.getStatus() != TicketStatus.CANCELLED
                && ticket.getDueAt().isBefore(Instant.now());
    }

    private boolean isOpenWork(Ticket ticket) {
        return ticket.getStatus() == TicketStatus.OPEN
                || ticket.getStatus() == TicketStatus.IN_PROGRESS
                || ticket.getStatus() == TicketStatus.ON_HOLD;
    }

    private List<TicketStatus> getAllowedStatusOptions(
            TicketStatus currentStatus,
            TicketPriority priority,
            boolean requiresExtendedResolution) {
        List<TicketStatus> nextOptions = switch (currentStatus) {
            case OPEN -> List.of(TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED);
            case IN_PROGRESS -> List.of(TicketStatus.IN_PROGRESS, TicketStatus.ON_HOLD, TicketStatus.RESOLVED, TicketStatus.CANCELLED);
            case ON_HOLD -> List.of(TicketStatus.ON_HOLD, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED);
            case RESOLVED -> List.of(TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.IN_PROGRESS);
            case CLOSED -> List.of(TicketStatus.CLOSED);
            case CANCELLED -> List.of(TicketStatus.CANCELLED);
        };

        return nextOptions.stream()
                .filter(status -> status != TicketStatus.ON_HOLD
                        || requiresExtendedResolution
                        || priority == TicketPriority.HIGH
                        || priority == TicketPriority.CRITICAL)
                .toList();
    }

    private String generateTicketId() {
        long sequence = ticketRepository.count() + 1;
        String datePart = DateTimeFormatter.ofPattern("uuuuMMdd").withZone(ZoneId.systemDefault()).format(Instant.now());
        return "TCK-" + datePart + "-" + String.format("%04d", sequence);
    }

    private String normalizeTicketCategory(String category) {
        String trimmed = category.trim();
        return LEGACY_CATEGORY_MAP.getOrDefault(trimmed, trimmed);
    }

    private boolean matchesSearch(Ticket ticket, String search) {
        if (search == null || search.isBlank()) {
            return true;
        }

        String haystack = String.join(" ",
                ticket.getTicketId(),
                ticket.getTitle(),
                ticket.getDescription(),
                ticket.getCategory(),
                formatLocation(ticket.getLocation()),
                ticket.getReporter().getFullName(),
                ticket.getAssignedTechnician() != null ? ticket.getAssignedTechnician().getFullName() : "")
                .toLowerCase(Locale.ENGLISH);

        return haystack.contains(search.trim().toLowerCase(Locale.ENGLISH));
    }

    private boolean matchesLocation(Ticket ticket, String location) {
        if (location == null || location.isBlank()) {
            return true;
        }

        return formatLocation(ticket.getLocation())
                .toLowerCase(Locale.ENGLISH)
                .contains(location.trim().toLowerCase(Locale.ENGLISH));
    }

    private String formatLocation(Ticket.Location location) {
        return List.of(
                        location.getBuilding(),
                        location.getFloor() != null ? "Floor " + location.getFloor() : "",
                        location.getRoom() != null ? "Room " + location.getRoom() : "",
                        location.getCampus() != null ? location.getCampus() : "")
                .stream()
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" | "));
    }

    private Instant resolveCompletedAt(Ticket ticket) {
        if (ticket.getResolvedAt() != null) {
            return ticket.getResolvedAt();
        }
        if (ticket.getClosedAt() != null) {
            return ticket.getClosedAt();
        }
        return ticket.getUpdatedAt();
    }

    private List<String> getLastSixMonthLabels() {
        List<String> labels = new ArrayList<>();
        Instant now = Instant.now();
        java.time.ZonedDateTime current = now.atZone(ZoneId.systemDefault()).withDayOfMonth(1);
        for (int index = 5; index >= 0; index--) {
            labels.add(MONTH_LABEL_FORMATTER.format(current.minusMonths(index)));
        }
        return labels;
    }

    private List<TicketReportsResponse.CountBucket> toCountBuckets(Map<String, Long> counts) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(String.CASE_INSENSITIVE_ORDER))
                .map(entry -> new TicketReportsResponse.CountBucket(entry.getKey(), entry.getValue()))
                .toList();
    }

    private String resolveDisplayName(User user) {
        if (user.getDisplayName() != null && !user.getDisplayName().isBlank()) {
            return user.getDisplayName().trim();
        }

        String[] parts = user.getEmail().split("@");
        String localPart = parts.length > 0 ? parts[0] : "Signed In User";
        String displayName = java.util.Arrays.stream(localPart.split("[^a-zA-Z0-9]+"))
                .filter(part -> !part.isBlank())
                .map(part -> Character.toUpperCase(part.charAt(0)) + part.substring(1))
                .collect(Collectors.joining(" "));
        return displayName.isBlank() ? "Signed In User" : displayName;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ENGLISH);
    }

    private boolean safeEquals(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private String slugifyFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "attachment";
        }

        return fileName.trim().toLowerCase(Locale.ENGLISH).replaceAll("\\s+", "-");
    }
}
