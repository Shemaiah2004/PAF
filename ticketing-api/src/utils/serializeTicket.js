function toId(value) {
  if (!value) {
    return "";
  }

  return value.toString();
}

function serializeEmbeddedUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: toId(user.userId ?? user._id ?? user.id),
    fullName: user.fullName,
    email: user.email ?? "",
    role: user.role,
  };
}

function serializeAttachment(attachment) {
  return {
    id: attachment.fileName,
    fileName: attachment.fileName,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    uploadedAt: attachment.uploadedAt,
    uploadedBy: serializeEmbeddedUser(attachment.uploadedBy),
  };
}

function serializeComment(comment) {
  return {
    id: toId(comment._id),
    message: comment.message,
    createdAt: comment.createdAt,
    author: serializeEmbeddedUser(comment.author),
  };
}

function serializeActivityItem(activityItem) {
  return {
    id: toId(activityItem._id),
    action: activityItem.action,
    message: activityItem.message,
    createdAt: activityItem.createdAt,
    actor: serializeEmbeddedUser(activityItem.actor),
    meta: activityItem.meta ?? {},
  };
}

export function serializeTicket(ticket) {
  return {
    id: toId(ticket._id ?? ticket.id),
    ticketId: ticket.ticketId,
    title: ticket.title,
    description: ticket.description,
    type: ticket.type,
    priority: ticket.priority,
    category: ticket.category,
    status: ticket.status,
    location: ticket.location,
    reporter: serializeEmbeddedUser(ticket.reporter),
    assignedTechnician: ticket.assignedTechnician?.userId
      ? serializeEmbeddedUser(ticket.assignedTechnician)
      : null,
    slaHours: ticket.slaHours,
    dueAt: ticket.dueAt,
    overdue: ticket.overdue,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
    attachments: (ticket.attachments ?? []).map(serializeAttachment),
    comments: (ticket.comments ?? []).map(serializeComment),
    activity: (ticket.activity ?? []).map(serializeActivityItem),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
