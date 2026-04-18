import React, { useEffect, useState } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import LoadingIndicator from "../../components/common/LoadingIndicator";
import Badge from "../../components/ui/badge/Badge";
import { useNotification } from "../../components/common/NotificationProvider";
import { Booking, getUserBookings, cancelBooking } from "../../lib/bookingService";
import { TrashBinIcon } from "../../icons";

interface RecurringGroup {
  groupId: string;
  bookings: Booking[];
  isRecurring: boolean;
}

export default function MyBookings() {
  const { showNotification } = useNotification();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      const data = await getUserBookings();
      setBookings(data);
    } catch (err) {
      setError("Failed to load your bookings");
    } finally {
      setIsLoading(false);
    }
  };

  // Group recurring bookings
  const getGroupedBookings = (): RecurringGroup[] => {
    const sorted = [...bookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const groups: RecurringGroup[] = [];
    const processed = new Set<string>();

    for (const booking of sorted) {
      if (processed.has(booking.id)) continue;

      const relatedBookings = sorted.filter(
        (b) =>
          b.resourceId === booking.resourceId &&
          b.startTime === booking.startTime &&
          b.endTime === booking.endTime &&
          b.purpose === booking.purpose &&
          b.attendees === booking.attendees &&
          !processed.has(b.id)
      );

      const isRecurring = relatedBookings.length > 1;
      const groupId = isRecurring
        ? `${booking.resourceId}_${booking.startTime}_${booking.endTime}_${booking.purpose}`
        : booking.id;

      groups.push({
        groupId,
        bookings: relatedBookings,
        isRecurring,
      });

      relatedBookings.forEach((b) => processed.add(b.id));
    }

    return groups;
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      await cancelBooking(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      showNotification({
        title: "Success",
        message: "Booking cancelled successfully",
        variant: "success",
      });
    } catch (err: any) {
      showNotification({
        title: "Error",
        message: err.message || "Failed to cancel booking",
        variant: "error",
      });
    }
  };

  const getStatusBadgeColor = (status: Booking["status"]) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "APPROVED":
        return "success";
      case "REJECTED":
        return "error";
      case "CANCELLED":
        return "light";
      default:
        return "info";
    }
  };

  const canCancel = (booking: Booking) => {
    return booking.status === "PENDING" || booking.status === "APPROVED";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    return `${hours}:${minutes}`;
  };

  const groupedData = getGroupedBookings();

  return (
    <>
      {isLoading ? (
        <ComponentCard title="My Bookings">
          <LoadingIndicator label="Loading your bookings..." />
        </ComponentCard>
      ) : error ? (
        <ComponentCard title="My Bookings">
          <div className="rounded-lg bg-error-50 p-4 text-error-700 dark:bg-error-950 dark:text-error-300">
            {error}
          </div>
        </ComponentCard>
      ) : bookings.length === 0 ? (
        <ComponentCard title="My Bookings">
          <div className="rounded-lg bg-blue-50 p-6 text-center dark:bg-blue-950">
            <p className="text-gray-600 dark:text-gray-400">No bookings yet. Create one to get started!</p>
          </div>
        </ComponentCard>
      ) : (
        <ComponentCard title="My Bookings" desc={`You have ${bookings.length} booking${bookings.length !== 1 ? "s" : ""}`}>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200 dark:border-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="border-r border-gray-200 px-2 py-3 text-center dark:border-gray-700 font-semibold" style={{ width: '48px' }}>{" "}</th>
                  <th className="border-r border-gray-200 px-3 py-3 text-left dark:border-gray-700 font-semibold" style={{ width: '120px' }}>Date</th>
                  <th className="border-r border-gray-200 px-3 py-3 text-left dark:border-gray-700 font-semibold" style={{ width: '130px' }}>Time</th>
                  <th className="border-r border-gray-200 px-3 py-3 text-left dark:border-gray-700 font-semibold" style={{ width: '150px' }}>Purpose</th>
                  <th className="border-r border-gray-200 px-3 py-3 text-center dark:border-gray-700 font-semibold" style={{ width: '90px' }}>Attendees</th>
                  <th className="border-r border-gray-200 px-3 py-3 text-left dark:border-gray-700 font-semibold" style={{ width: '110px' }}>Status</th>
                  <th className="px-3 py-3 text-center dark:border-gray-700 font-semibold" style={{ width: '70px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.map((group) => (
                  <React.Fragment key={group.groupId}>
                    {/* Group Header Row (for recurring bookings) */}
                    {group.isRecurring && (
                      <tr style={{ borderBottom: '2px solid #3b82f6' }} className="bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/50 dark:hover:bg-blue-900/60">
                        <td style={{ width: '48px', padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #bfdbfe' }} className="dark:border-blue-800">
                          <button
                            onClick={() => toggleGroup(group.groupId)}
                            className="inline-flex items-center justify-center rounded p-1 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                            title={expandedGroups.has(group.groupId) ? "Collapse" : "Expand"}
                          >
                            <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                              {expandedGroups.has(group.groupId) ? "▼" : "▶"}
                            </span>
                          </button>
                        </td>
                        <td colSpan={6} style={{ padding: '12px' }}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-blue-900 dark:text-blue-100 text-base">
                                📋 Recurring: <span className="font-bold">{group.bookings[0].purpose}</span>
                              </p>
                              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                ⏰ {group.bookings[0].startTime} - {group.bookings[0].endTime} &nbsp;•&nbsp; 📅 {group.bookings.length} sessions
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Individual Booking Rows */}
                    {(group.isRecurring ? expandedGroups.has(group.groupId) : true) &&
                      group.bookings.map((booking) => (
                        <tr
                          key={booking.id}
                          style={{
                            borderBottom: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb')
                          }}
                          className={group.isRecurring ? "bg-white dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 dark:border-blue-900" : "hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"}
                        >
                        <td style={{ width: '48px', padding: '12px 8px', textAlign: 'center', borderRight: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb') }} className={group.isRecurring ? "dark:border-blue-900" : "dark:border-gray-700"}>
                            {group.isRecurring && (
                              <span className="text-lg text-blue-600 dark:text-blue-400">├</span>
                            )}
                          </td>
                          <td style={{ width: '120px', padding: '12px', borderRight: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb') }} className={group.isRecurring ? "dark:border-blue-900" : "dark:border-gray-700"}>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(booking.date)}</span>
                          </td>
                          <td style={{ width: '130px', padding: '12px', borderRight: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb') }} className={group.isRecurring ? "dark:border-blue-900" : "dark:border-gray-700"}>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                          </td>
                          <td style={{ width: '150px', padding: '12px', borderRight: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb') }} className={group.isRecurring ? "dark:border-blue-900" : "dark:border-gray-700"}>
                            <span className="text-sm text-gray-900 dark:text-white font-medium">{booking.purpose}</span>
                          </td>
                          <td style={{ width: '90px', padding: '12px', textAlign: 'center', borderRight: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb') }} className={group.isRecurring ? "dark:border-blue-900" : "dark:border-gray-700"}>
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{booking.attendees}</span>
                          </td>
                          <td style={{ width: '110px', padding: '12px', borderRight: '1px solid' + (group.isRecurring ? '#dbeafe' : '#e5e7eb') }} className={group.isRecurring ? "dark:border-blue-900" : "dark:border-gray-700"}>
                            <Badge color={getStatusBadgeColor(booking.status)} variant="solid" size="sm">
                              {booking.status}
                            </Badge>
                            {booking.reason && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {booking.reason}
                              </p>
                            )}
                          </td>
                          <td style={{ width: '70px', padding: '12px', textAlign: 'center' }}>
                            {canCancel(booking) ? (
                              <button
                                onClick={() => handleCancel(booking.id)}
                                className="inline-flex items-center justify-center rounded p-2 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                title="Cancel booking"
                              >
                                <TrashBinIcon className="h-4 w-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" />
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </ComponentCard>
      )}
    </>
  );
}
