import { Ticket } from "../models/Ticket.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createHttpError } from "../utils/httpError.js";
import { buildTicketId } from "../utils/generateTicketId.js";
import { serializeTicket } from "../utils/serializeTicket.js";

const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const defaultCategories = [
  "Air Conditioning",
  "Electricity / Lighting",
  "Water / Plumbing",
  "Internet / Wi-Fi",
  "Classroom Equipment",
  "Access / Security",
  "Cleaning / Housekeeping",
  "Furniture / Facility Damage",
  "Other",
];

function actorFromUser(user) {
  return {
    userId: user._id,
    fullName: user.fullName,
    role: user.role,
  };
}

function reporterFromUser(user) {
  return {
    userId: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

function appendActivity(ticket, action, message, actor, meta = {}) {
  ticket.activity.push({
    action,
    message,
    actor,
    meta,
    createdAt: new Date(),
  });
}

async function nextTicketId() {
  const totalCount = await Ticket.countDocuments();
  return buildTicketId(totalCount + 1);
}

function canSeeTicket(user, ticket) {
  if (["ADMIN", "TECHNICIAN"].includes(user.role)) {
    return true;
  }

  return ticket.reporter.userId.toString() === user._id.toString();
}

function buildListQuery(user, filters) {
  const query = {};

  if (user.role === "USER") {
    query["reporter.userId"] = user._id;
  }

  if (filters.type) query.type = filters.type;
  if (filters.priority) query.priority = filters.priority;
  if (filters.category) query.category = filters.category;
  if (filters.status) query.status = filters.status;
  if (filters.overdue === "true") query.overdue = true;
  if (filters.assignedTechnicianId) {
    query["assignedTechnician.userId"] = filters.assignedTechnicianId;
  }
  if (filters.location) {
    query.$or = [
      { "location.building": new RegExp(filters.location, "i") },
      { "location.room": new RegExp(filters.location, "i") },
      { "location.campus": new RegExp(filters.location, "i") },
    ];
  }
  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  return query;
}

export const getTicketMeta = asyncHandler(async (_req, res) => {
  const technicians = await User.find({
    role: { $in: ["TECHNICIAN", "ADMIN"] },
    isActive: true,
  })
    .sort({ fullName: 1 })
    .lean();

  res.json({
    types: ["MAINTENANCE", "INCIDENT"],
    priorities: validPriorities,
    categories: defaultCategories,
    statuses: ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "CANCELLED"],
    technicians: technicians.map((user) => ({
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      skills: user.skills ?? [],
    })),
  });
});

export const listTickets = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100);
  const query = buildListQuery(req.user, req.query);

  const [items, total] = await Promise.all([
    Ticket.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Ticket.countDocuments(query),
  ]);

  res.json({
    items: items.map(serializeTicket),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

export const createTicket = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    type,
    priority,
    category,
    location,
    slaHours,
  } = req.body;

  if (
    !title?.trim() ||
    !description?.trim() ||
    !type ||
    !priority ||
    !category?.trim() ||
    !location?.building?.trim()
  ) {
    throw createHttpError(
      400,
      "title, description, type, priority, category, and location.building are required."
    );
  }

  if (!validPriorities.includes(priority)) {
    throw createHttpError(400, "priority must be one of LOW, MEDIUM, HIGH, or CRITICAL.");
  }

  const finalSlaHours =
    req.user.role === "USER"
      ? { LOW: 72, MEDIUM: 24, HIGH: 8, CRITICAL: 4 }[priority]
      : Number.isFinite(Number(slaHours)) && Number(slaHours) > 0
        ? Number(slaHours)
        : { LOW: 72, MEDIUM: 24, HIGH: 8, CRITICAL: 4 }[priority];
  const ticket = await Ticket.create({
    ticketId: await nextTicketId(),
    title: title.trim(),
    description: description.trim(),
    type,
    priority,
    category: category.trim(),
    status: "OPEN",
    location: {
      ...location,
      building: location.building.trim(),
      floor: location.floor?.trim() || "",
      room: location.room?.trim() || "",
      campus: location.campus?.trim() || "",
      note: type === "INCIDENT" ? location.note?.trim() || "" : "",
    },
    reporter: reporterFromUser(req.user),
    slaHours: finalSlaHours,
    dueAt: new Date(Date.now() + finalSlaHours * 60 * 60 * 1000),
    activity: [
      {
        action: "TICKET_CREATED",
        message: `Ticket created with ${priority} priority.`,
        actor: actorFromUser(req.user),
        meta: {
          priority,
          category,
          type,
        },
      },
    ],
  });

  console.info("[ticketing-api] Ticket created", {
    ticketId: ticket.ticketId,
    reporterEmail: ticket.reporter.email,
    mongoId: ticket._id.toString(),
  });

  res.status(201).json(serializeTicket(ticket));
});

export const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    throw createHttpError(404, "Ticket not found.");
  }

  if (!canSeeTicket(req.user, ticket)) {
    throw createHttpError(403, "You do not have access to this ticket.");
  }

  res.json(serializeTicket(ticket));
});

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    throw createHttpError(404, "Ticket not found.");
  }

  if (!["ADMIN", "TECHNICIAN"].includes(req.user.role)) {
    throw createHttpError(403, "Only technicians and admins can update tickets.");
  }

  const allowedFields = [
    "title",
    "description",
    "type",
    "priority",
    "category",
    "status",
    "location",
    "slaHours",
  ];

  for (const field of allowedFields) {
    if (field in req.body) {
      ticket[field] = req.body[field];
    }
  }

  if (
    "priority" in req.body ||
    "slaHours" in req.body
  ) {
    const finalSlaHours =
      Number.isFinite(Number(ticket.slaHours)) && Number(ticket.slaHours) > 0
        ? Number(ticket.slaHours)
        : { LOW: 72, MEDIUM: 24, HIGH: 8, CRITICAL: 4 }[ticket.priority];
    ticket.slaHours = finalSlaHours;
    ticket.dueAt = new Date(ticket.createdAt.getTime() + finalSlaHours * 60 * 60 * 1000);
  }

  appendActivity(
    ticket,
    "TICKET_UPDATED",
    "Ticket details were updated.",
    actorFromUser(req.user),
    req.body
  );

  await ticket.save();
  res.json(serializeTicket(ticket));
});

export const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    throw createHttpError(404, "Ticket not found.");
  }

  if (req.user.role !== "ADMIN") {
    throw createHttpError(403, "Only admins can delete tickets.");
  }

  await ticket.deleteOne();
  res.status(204).send();
});

export const assignTechnician = asyncHandler(async (req, res) => {
  const { technicianId } = req.body;
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    throw createHttpError(404, "Ticket not found.");
  }

  if (req.user.role !== "ADMIN") {
    throw createHttpError(403, "Only admins can assign technicians.");
  }

  const technician = await User.findById(technicianId).lean();

  if (!technician || !["TECHNICIAN", "ADMIN"].includes(technician.role)) {
    throw createHttpError(400, "Valid technicianId is required.");
  }

  ticket.assignedTechnician = {
    userId: technician._id,
    fullName: technician.fullName,
    email: technician.email,
    role: technician.role,
  };

  if (ticket.status === "OPEN") {
    ticket.status = "IN_PROGRESS";
  }

  appendActivity(
    ticket,
    "TECHNICIAN_ASSIGNED",
    `${technician.fullName} was assigned to the ticket.`,
    actorFromUser(req.user),
    { technicianId: technician._id.toString() }
  );

  await ticket.save();
  res.json(serializeTicket(ticket));
});

export const addComment = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    throw createHttpError(404, "Ticket not found.");
  }

  if (!canSeeTicket(req.user, ticket)) {
    throw createHttpError(403, "You do not have access to this ticket.");
  }

  if (!message?.trim()) {
    throw createHttpError(400, "Comment message is required.");
  }

  ticket.comments.push({
    message: message.trim(),
    author: actorFromUser(req.user),
  });

  appendActivity(
    ticket,
    "COMMENT_ADDED",
    "A new comment was added.",
    actorFromUser(req.user)
  );

  await ticket.save();
  res.status(201).json(serializeTicket(ticket));
});

export const uploadAttachments = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    throw createHttpError(404, "Ticket not found.");
  }

  if (!canSeeTicket(req.user, ticket)) {
    throw createHttpError(403, "You do not have access to this ticket.");
  }

  const uploadedFiles = req.files ?? [];
  if (!uploadedFiles.length) {
    throw createHttpError(400, "At least one attachment is required.");
  }

  const actor = actorFromUser(req.user);
  const attachments = uploadedFiles.map((file) => ({
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
    uploadedBy: actor,
  }));

  ticket.attachments.push(...attachments);

  appendActivity(
    ticket,
    "ATTACHMENT_UPLOADED",
    `${attachments.length} attachment(s) uploaded.`,
    actor,
    { count: attachments.length }
  );

  await ticket.save();
  res.status(201).json(serializeTicket(ticket));
});
