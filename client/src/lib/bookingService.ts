import { getStoredAuthSession, authApiBaseUrl } from "./auth";

const API_BASE_URL = `${authApiBaseUrl}/api/bookings`;

export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  date: string; // LocalDate as string (YYYY-MM-DD)
  startTime: string; // LocalTime as string (HH:mm:ss)
  endTime: string; // LocalTime as string (HH:mm:ss)
  purpose: string;
  attendees: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string;
  createdAt: string; // LocalDateTime as string
}

export interface CreateBookingRequest {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  attendees: number;
  recurrenceType: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"; // Recurrence type (default: NONE)
  recurrenceEndDate?: string; // When the recurrence should end (YYYY-MM-DD)
}

const getHeaders = (): HeadersInit => {
  const session = getStoredAuthSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (session && session.userId) {
    headers["X-Auth-User-Id"] = session.userId;
  }
  
  return headers;
};

/**
 * Create a new booking
 */
export const createBooking = async (bookingRequest: CreateBookingRequest): Promise<Booking> => {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(bookingRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create booking");
  }

  return await response.json();
};

/**
 * Get current user's bookings
 */
export const getUserBookings = async (): Promise<Booking[]> => {
  const response = await fetch(`${API_BASE_URL}/my`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch your bookings");
  }

  return await response.json();
};

/**
 * Get all bookings (admin only)
 */
export const getAllBookings = async (): Promise<Booking[]> => {
  const response = await fetch(API_BASE_URL, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch bookings");
  }

  return await response.json();
};

/**
 * Get a specific booking by ID
 */
export const getBookingById = async (id: string): Promise<Booking> => {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: "GET",
    headers: getHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch booking");
  }

  return await response.json();
};

/**
 * Cancel a booking (user can cancel own bookings)
 */
export const cancelBooking = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to cancel booking");
  }
};

/**
 * Update booking status (admin only)
 */
export const updateBookingStatus = async (
  id: string,
  status: "APPROVED" | "REJECTED" | "CANCELLED",
  reason?: string
): Promise<Booking> => {
  const response = await fetch(`${API_BASE_URL}/${id}/status`, {
    method: "PUT",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ status, reason }),
  });

  if (!response.ok) {
    throw new Error("Failed to update booking status");
  }

  return await response.json();
};

/**
 * Get bookings for a specific resource and date (only APPROVED and PENDING)
 * Tries to get all bookings (admin), falls back to user's bookings if not authorized
 */
export const getResourceBookingsForDate = async (resourceId: string, date: string): Promise<Booking[]> => {
  try {
    let allBookings: Booking[] = [];
    
    // Try to get all bookings (admin endpoint)
    try {
      allBookings = await getAllBookings();
    } catch (adminErr) {
      // If not admin, try getting just user's bookings
      console.warn("Not authorized to fetch all bookings, trying user bookings:", adminErr);
      allBookings = await getUserBookings();
    }
    
    // Filter for the specific resource and date, excluding rejected/cancelled
    return allBookings.filter(
      (booking) =>
        booking.resourceId === resourceId &&
        booking.date === date &&
        (booking.status === "APPROVED" || booking.status === "PENDING")
    );
  } catch (err) {
    console.error("Failed to fetch resource bookings for date:", err);
    return [];
  }
};

/**
 * Convert time string (HH:mm or HH:mm:ss) to minutes since midnight
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

/**
 * Check if two time slots conflict
 */
export const hasTimeConflict = (
  startTime1: string,
  endTime1: string,
  startTime2: string,
  endTime2: string
): boolean => {
  const start1 = timeToMinutes(startTime1);
  const end1 = timeToMinutes(endTime1);
  const start2 = timeToMinutes(startTime2);
  const end2 = timeToMinutes(endTime2);
  
  // Conflict if: start1 < end2 AND end1 > start2
  return start1 < end2 && end1 > start2;
};

/**
 * Find the next available time slot after a given time
 * Returns the next available start time or null if no slot found
 */
export const findNextAvailableSlot = (
  bookedSlots: Booking[],
  proposedStartTime: string,
  slotDurationMinutes: number = 60
): { availableStartTime: string; reason: string } | null => {
  const DAY_START = 8 * 60; // 08:00
  const DAY_END = 18 * 60; // 18:00

  let currentStartMinutes = timeToMinutes(proposedStartTime);

  // Check if proposed time is outside working hours
  if (currentStartMinutes < DAY_START) {
    currentStartMinutes = DAY_START;
  }

  // Try to find next available slot
  while (currentStartMinutes + slotDurationMinutes <= DAY_END) {
    const currentEndMinutes = currentStartMinutes + slotDurationMinutes;
    const testStartTime = minutesToTime(currentStartMinutes);
    const testEndTime = minutesToTime(currentEndMinutes);

    // Check if this slot conflicts with any booked slots
    const hasConflict = bookedSlots.some((booking) =>
      hasTimeConflict(testStartTime, testEndTime, booking.startTime, booking.endTime)
    );

    if (!hasConflict) {
      return {
        availableStartTime: testStartTime,
        reason: `Next available slot: ${testStartTime} - ${testEndTime}`,
      };
    }

    // Move to next 15-minute slot
    currentStartMinutes += 15;
  }

  return null;
};

/**
 * Get all booked time slots for display
 */
export const getBookedTimeSlots = (bookings: Booking[]): Array<{ start: string; end: string; status: string }> => {
  return bookings.map((booking) => ({
    start: booking.startTime,
    end: booking.endTime,
    status: booking.status,
  }));
};
