import { Ticket } from "../models/Ticket.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeTicket } from "../utils/serializeTicket.js";

const statusOrder = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "CANCELLED"];
const priorityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const typeOrder = ["MAINTENANCE", "INCIDENT"];

function getAccessMatch(user) {
  if (user.role === "USER") {
    return { "reporter.userId": user._id };
  }

  return {};
}

function getLastSixMonthKeys() {
  return Array.from({ length: 6 }, (_, index) => {
    const current = new Date();
    current.setDate(1);
    current.setMonth(current.getMonth() - (5 - index));
    return {
      key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`,
      label: current.toLocaleString(undefined, {
        month: "short",
        year: "numeric",
      }),
    };
  });
}

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const accessMatch = getAccessMatch(req.user);

  const [statusBreakdown, priorityBreakdown, typeBreakdown, overdueCount, totalTickets, recentTickets] =
    await Promise.all([
      Ticket.aggregate([
        { $match: accessMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Ticket.aggregate([
        { $match: accessMatch },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Ticket.aggregate([
        { $match: accessMatch },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Ticket.countDocuments({ ...accessMatch, overdue: true }),
      Ticket.countDocuments(accessMatch),
      Ticket.find(accessMatch).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

  const monthlyTrend = await Ticket.aggregate([
    { $match: accessMatch },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        created: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const openCount = statusBreakdown
    .filter((item) => ["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(item._id))
    .reduce((sum, item) => sum + item.count, 0);
  const monthlyLookup = new Map(
    monthlyTrend.map((item) => [
      `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      item.created,
    ])
  );

  res.json({
    cards: {
      totalTickets,
      openTickets: openCount,
      overdueTickets: overdueCount,
      resolvedRate:
        totalTickets === 0
          ? 0
          : Math.round(
              (((statusBreakdown.find((item) => item._id === "RESOLVED")?.count ?? 0) +
                (statusBreakdown.find((item) => item._id === "CLOSED")?.count ?? 0)) /
                totalTickets) *
                100
            ),
    },
    charts: {
      statusBreakdown: statusOrder.map((label) => ({
        _id: label,
        count: statusBreakdown.find((item) => item._id === label)?.count ?? 0,
      })),
      priorityBreakdown: priorityOrder.map((label) => ({
        _id: label,
        count: priorityBreakdown.find((item) => item._id === label)?.count ?? 0,
      })),
      typeBreakdown: typeOrder.map((label) => ({
        _id: label,
        count: typeBreakdown.find((item) => item._id === label)?.count ?? 0,
      })),
      monthlyTrend: getLastSixMonthKeys().map((item) => ({
        label: item.label,
        created: monthlyLookup.get(item.key) ?? 0,
      })),
    },
    recentTickets: recentTickets.map(serializeTicket),
  });
});
