import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useNotification } from "../../components/common/NotificationProvider";
import Button from "../../components/ui/button/Button";
import DatePicker from "../../components/ui/DatePicker";
import { Resource } from "../../lib/resourceService";
import { 
  createBooking, 
  CreateBookingRequest,
  getResourceBookingsForDate,
  hasTimeConflict,
  findNextAvailableSlot,
  timeToMinutes
} from "../../lib/bookingService";
import { BoxCubeIcon, GridIcon, TableIcon, BoxIconLine, CalenderIcon, TimeIcon, UserIcon, InfoIcon, CheckCircleIcon, AlertIcon } from "../../icons";

interface BookingFormProps {
  resources: Resource[];
}

// Asset type mapping for display with descriptions
const assetTypeConfig: Record<
  string,
  { label: string; description: string; icon: React.ReactNode }
> = {
  LECTURE_HALL: {
    label: "Lecture Hall",
    description: "Large rooms for lectures and presentations",
    icon: <GridIcon className="h-5 w-5" />,
  },
  LAB: {
    label: "Lab",
    description: "Laboratory spaces for experiments and practicals",
    icon: <BoxIconLine className="h-5 w-5" />,
  },
  MEETING_ROOM: {
    label: "Assignment Room",
    description: "Meeting rooms for group work and discussions",
    icon: <TableIcon className="h-5 w-5" />,
  },
  EQUIPMENT: {
    label: "Equipment",
    description: "Specialized equipment and resources",
    icon: <BoxCubeIcon className="h-5 w-5" />,
  },
};

// Legacy helper for backward compatibility
const assetTypeLabels: Record<string, string> = Object.entries(
  assetTypeConfig
).reduce((acc, [key, value]) => ({ ...acc, [key]: value.label }), {});

export default function BookingForm({ resources }: BookingFormProps) {
  const [searchParams] = useSearchParams();
  const initialResourceId = searchParams.get("resourceId") || "";

  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<string>("");
  const [resourceSearchQuery, setResourceSearchQuery] = useState<string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateBookingRequest>({
    resourceId: initialResourceId,
    date: "",
    startTime: "",
    endTime: "",
    purpose: "",
    attendees: 1,
    recurrenceType: "NONE",
    recurrenceEndDate: "",
  });

  // State for conflict detection and availability
  const [bookedSlots, setBookedSlots] = useState<Array<{ start: string; end: string; status: string }>>([]);
  const [hasConflict, setHasConflict] = useState(false);
  const [nextAvailableSlot, setNextAvailableSlot] = useState<{ availableStartTime: string; reason: string } | null>(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Auto-select asset type based on initial resource from URL
  useEffect(() => {
    if (initialResourceId && resources.length > 0) {
      const selectedRes = resources.find((r) => r.id === initialResourceId);
      if (selectedRes) {
        setSelectedAssetType(selectedRes.type);
      }
    }
  }, [initialResourceId, resources]);

  // Filter resources based on selected asset type and search query
  const filteredResources = resources
    .filter((r) => selectedAssetType ? r.type === selectedAssetType : true)
    .filter((r) => {
      const query = resourceSearchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(query) ||
        r.location.toLowerCase().includes(query) ||
        assetTypeLabels[r.type].toLowerCase().includes(query)
      );
    });

  // Calculate form completion
  const requiredFields = ["resourceId", "date", "startTime", "endTime", "purpose"];
  const completedFields = requiredFields.filter((field) => {
    const value = formData[field as keyof CreateBookingRequest];
    if (field === "startTime" && formData.endTime && formData.startTime >= formData.endTime) return false;
    return value && value !== "";
  }).length;
  const completionPercentage = Math.round((completedFields / requiredFields.length) * 100);

  // Calculate number of recurrences
  const calculateRecurrenceCount = () => {
    if (!formData.date || !formData.recurrenceEndDate || (formData.recurrenceType as string) === "NONE") {
      return 0;
    }

    const start = new Date(formData.date);
    const end = new Date(formData.recurrenceEndDate);
    const timeDiff = end.getTime() - start.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    switch (formData.recurrenceType) {
      case "DAILY":
        return dayDiff + 1;
      case "WEEKLY":
        return Math.floor(dayDiff / 7) + 1;
      case "MONTHLY": {
        let months = (end.getFullYear() - start.getFullYear()) * 12;
        months += end.getMonth() - start.getMonth();
        return months + 1;
      }
      default:
        return 0;
    }
  };

  const recurrenceCount = calculateRecurrenceCount();

  // Get selected resource
  const selectedResource = formData.resourceId ? resources.find((r) => r.id === formData.resourceId) : null;

  // Fetch booked slots when resource and date change
  useEffect(() => {
    const loadBookedSlots = async () => {
      if (formData.resourceId && formData.date) {
        try {
          setIsLoadingBookings(true);
          const bookings = await getResourceBookingsForDate(formData.resourceId, formData.date);
          const slots = bookings.map((b) => ({
            start: b.startTime,
            end: b.endTime,
            status: b.status,
          }));
          setBookedSlots(slots);
        } catch (err) {
          console.error("Failed to load booked slots:", err);
          setBookedSlots([]);
        } finally {
          setIsLoadingBookings(false);
        }
      } else {
        setBookedSlots([]);
      }
    };

    loadBookedSlots();
  }, [formData.resourceId, formData.date]);

  // Calculate duration in minutes
  const calculateDuration = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const [startH, startM] = formData.startTime.split(":").map(Number);
    const [endH, endM] = formData.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return Math.max(0, endMinutes - startMinutes);
  };

  const durationMinutes = useMemo(() => calculateDuration(), [formData.startTime, formData.endTime]);

  // Apply time preset
  const applyTimePreset = (durationInMinutes: number) => {
    // Use current startTime or default to 09:00 if not set
    const startTimeStr = formData.startTime || "09:00";
    const [startH, startM] = startTimeStr.split(":").map(Number);
    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = startTotalMinutes + durationInMinutes;
    
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;
    
    const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    
    setFormData(prev => ({
      ...prev,
      startTime: prev.startTime || "09:00",
      endTime: endTimeStr,
    }));
  };

  const validateField = (name: string, value: string | number): string | null => {
    if (name === "resourceId" && !value) return "Please select a resource";
    if (name === "date" && !value) return "Please select a date";
    if (name === "startTime" && !value) return "Start time is required";
    if (name === "endTime" && !value) return "End time is required";
    if (name === "startTime" || name === "endTime") {
      if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
        return "End time must be after start time";
      }
    }
    if (name === "purpose" && !value) return "Purpose is required";
    if (name === "attendees" && selectedResource && (selectedResource?.capacity ?? 0) > 0 && parseInt(value?.toString() || "0", 10) > (selectedResource?.capacity ?? 0)) {
      return `Exceeds capacity (max ${selectedResource?.capacity})`;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numValue = name === "attendees" ? parseInt(value, 10) : value;
    
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));

    // Auto-select resource type when resource is selected and clear search
    if (name === "resourceId" && value) {
      const selectedRes = resources.find((r) => r.id === value);
      if (selectedRes) {
        setSelectedAssetType(selectedRes.type);
      }
      setResourceSearchQuery("");
    }

    // Check for time conflicts when start or end time changes
    if ((name === "startTime" || name === "endTime") && formData.date && formData.resourceId) {
      const newStartTime = name === "startTime" ? (value as string) : formData.startTime;
      const newEndTime = name === "endTime" ? (value as string) : formData.endTime;

      if (newStartTime && newEndTime && newStartTime < newEndTime) {
        // Check for conflicts with booked slots
        const conflict = bookedSlots.some((slot) =>
          hasTimeConflict(newStartTime, newEndTime, slot.start, slot.end)
        );
        setHasConflict(conflict);

        // If there's a conflict, find next available slot
        if (conflict) {
          const nextSlot = findNextAvailableSlot(
            bookedSlots.map((slot) => ({
              resourceId: formData.resourceId,
              userId: "",
              id: "",
              date: formData.date,
              startTime: slot.start,
              endTime: slot.end,
              purpose: "",
              attendees: 0,
              status: slot.status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED",
              createdAt: "",
            })),
            newStartTime,
            timeToMinutes(newEndTime) - timeToMinutes(newStartTime)
          );
          setNextAvailableSlot(nextSlot);
        } else {
          setNextAvailableSlot(null);
        }
      } else {
        setHasConflict(false);
        setNextAvailableSlot(null);
      }
    }

    // Real-time validation
    const error = validateField(name, numValue);
    setFormErrors((prev) => ({
      ...prev,
      [name]: error || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation
    const newErrors: Record<string, string> = {};
    requiredFields.forEach((field) => {
      const value = formData[field as keyof CreateBookingRequest];
      const error = validateField(field, value !== undefined ? value : "");
      if (error) newErrors[field] = error;
    });

    // Validate recurrence end date if recurrence is selected
    if ((formData.recurrenceType as string) !== "NONE") {
      if (!formData.recurrenceEndDate) {
        newErrors.recurrenceEndDate = "Recurrence end date is required";
      } else if (new Date(formData.recurrenceEndDate) <= new Date(formData.date)) {
        newErrors.recurrenceEndDate = "Recurrence end date must be after start date";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      showNotification({
        title: "Validation Error",
        message: "Please fix the errors before submitting",
        variant: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createBooking(formData);

      showNotification({
        title: "Success",
        message: "Booking created successfully. Status is PENDING.",
        variant: "success",
      });

      // Store the resource and date before resetting
      const currentResourceId = formData.resourceId;
      const currentDate = formData.date;

      // Immediately add the newly created booking to the booked slots list
      // This ensures the user sees their booking right away without waiting for backend
      setBookedSlots((prev) => [
        ...prev,
        {
          start: formData.startTime,
          end: formData.endTime,
          status: "PENDING",
        },
      ]);

      // Reset only the time and purpose fields, keep resource and date
      // This allows users to immediately see their new booking in the list
      setFormData({
        resourceId: currentResourceId,
        date: currentDate,
        startTime: "",
        endTime: "",
        purpose: "",
        attendees: 1,
        recurrenceType: "NONE",
        recurrenceEndDate: "",
      });

      setFormErrors({});
    } catch (err: any) {
      showNotification({
        title: "Error",
        message: err.message || "Failed to create booking",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Completion Progress - Enhanced */}
      <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50/80 to-blue-50/80 p-5 shadow-sm dark:border-brand-800 dark:from-brand-950/40 dark:to-gray-900/40">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Booking Progress</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Complete all required fields to book</p>
          </div>
          <span className="rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {completedFields}/{requiredFields.length}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 shadow-inner dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 shadow-lg transition-all duration-500 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {completionPercentage === 100 ? "✅ Ready to submit!" : `${100 - completionPercentage}% remaining`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: SELECT RESOURCE */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 p-3 shadow-md">
              <GridIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Select Resource</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Step 1 of 3</p>
            </div>
          </div>

          {/* Asset Type Selection */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Select Resource Type</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Choose the type of resource you need</p>
              </div>
              {selectedAssetType && (
                <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  Filtering...
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
              {/* All Types Button */}
              <button
                type="button"
                onClick={() => setSelectedAssetType("")}
                className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-4 transition-all duration-200 ${
                  selectedAssetType === ""
                    ? "border-brand-500 bg-gradient-to-br from-brand-50 to-blue-50 shadow-md dark:from-brand-950 dark:to-gray-900"
                    : "border-gray-200 hover:border-brand-300 dark:border-gray-600 dark:hover:border-brand-600"
                }`}
              >
                <div className={`transition duration-200 ${selectedAssetType === "" ? "scale-110 text-brand-600 dark:text-brand-400" : "text-gray-600 group-hover:text-brand-500 dark:text-gray-400 dark:group-hover:text-brand-400"}`}>
                  <GridIcon className="h-6 w-6" />
                </div>
                <span className={`text-center text-sm font-semibold leading-tight transition duration-200 ${selectedAssetType === "" ? "text-brand-700 dark:text-brand-300" : "text-gray-700 dark:text-gray-300"}`}>
                  All Types
                </span>
              </button>

              {/* Individual Asset Type Buttons */}
              {Object.entries(assetTypeConfig).map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedAssetType(type)}
                  className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-4 transition-all duration-200 ${
                    selectedAssetType === type
                      ? "border-brand-500 bg-gradient-to-br from-brand-50 to-blue-50 shadow-md dark:from-brand-950 dark:to-gray-900"
                      : "border-gray-200 hover:border-brand-300 dark:border-gray-600 dark:hover:border-brand-600"
                  }`}
                  title={config.description}
                >
                  <div className={`transition duration-200 ${selectedAssetType === type ? "scale-110 text-brand-600 dark:text-brand-400" : "text-gray-600 group-hover:text-brand-500 dark:text-gray-400 dark:group-hover:text-brand-400"}`}>
                    {config.icon}
                  </div>
                  <span className={`text-center text-sm font-semibold leading-tight transition duration-200 ${selectedAssetType === type ? "text-brand-700 dark:text-brand-300" : "text-gray-700 dark:text-gray-300"}`}>
                    {config.label}
                  </span>
                  {selectedAssetType === type && (
                    <span className="text-xs text-brand-600 dark:text-brand-400">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Resource Selection */}
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Resource *</label>
              {formData.resourceId && !formErrors.resourceId && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
              {formErrors.resourceId && <AlertIcon className="h-4 w-4 text-red-500" />}
            </div>
            
            {/* Resource Search Box */}
            <div className="mb-4 relative">
              <input
                type="text"
                placeholder="🔍 Search resources by name, location, or type..."
                value={resourceSearchQuery}
                onChange={(e) => setResourceSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              />
              {resourceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setResourceSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedAssetType && (
              <p className="mb-3 text-xs font-medium text-brand-600 dark:text-brand-400">
                ✓ {filteredResources.length} {assetTypeConfig[selectedAssetType]?.label.toLowerCase() || "resource"}{filteredResources.length !== 1 ? "s" : ""} available
              </p>
            )}
            {resourceSearchQuery && (
              <p className="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                Found {filteredResources.length} matching resource{filteredResources.length !== 1 ? "s" : ""}
              </p>
            )}
            <select
              name="resourceId"
              value={formData.resourceId}
              onChange={handleChange}
              required
              className={`w-full rounded-lg border px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-white transition-all ${
                formErrors.resourceId
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500/50 dark:border-red-600"
                  : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/50 dark:border-gray-600"
              }`}
            >
              <option value="">{filteredResources.length === 0 ? "❌ No resources found" : "📌 Select a resource..."}</option>
              {filteredResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} • {assetTypeLabels[resource.type]} • {resource.capacity}p • {resource.location}
                </option>
              ))}
            </select>
            {formErrors.resourceId && <p className="mt-2 text-xs text-red-600 dark:text-red-400">⚠️ {formErrors.resourceId}</p>}

            {/* Resource Details Card */}
            {selectedResource && (
              <div className="mt-4 rounded-lg border border-brand-200 bg-gradient-to-br from-brand-50 to-blue-50 p-5 dark:border-brand-900 dark:from-brand-950/30 dark:to-gray-900/30">
                <div className="space-y-4">
                  {/* Header with name and type */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Selected Resource</p>
                      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{selectedResource.name}</p>
                    </div>
                    <span className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300 whitespace-nowrap">
                      {assetTypeLabels[selectedResource.type]}
                    </span>
                  </div>

                  {/* Location and Capacity Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-800/50">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">📍 Location</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedResource.location}</p>
                    </div>
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-800/50">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">👥 Capacity</p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedResource.capacity} people</p>
                    </div>
                  </div>

                  {/* Availability Windows */}
                  {selectedResource.availabilityWindows && (
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-gray-800/50">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">⏰ Availability</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedResource.availabilityWindows}</p>
                    </div>
                  )}

                  {/* Description if available */}
                  {selectedResource.description && (
                    <div className="border-t border-brand-100 pt-3 dark:border-brand-900/50">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{selectedResource.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: SCHEDULE BOOKING */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 p-3 shadow-md">
              <CalenderIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Schedule Booking</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Step 2 of 3</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Date */}
            <div>
              <DatePicker
                label="Date *"
                value={formData.date}
                onChange={(date) => {
                  setFormData((prev) => ({
                    ...prev,
                    date,
                  }));
                }}
                minDate={new Date().toISOString().split("T")[0]}
                error={!!formErrors.date}
                errorMessage={formErrors.date}
                placeholder="Select booking date"
                required
                showWeekday
              />
            </div>

            {/* Time Range */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Time Range *</label>
                {formData.startTime && formData.endTime && formData.startTime < formData.endTime && !formErrors.startTime && !formErrors.endTime && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
              </div>
              
              {/* Time Inputs */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    required
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 dark:bg-gray-800 dark:text-white ${
                      formErrors.startTime
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:focus:border-red-500"
                        : "border-gray-300 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-400"
                    }`}
                  />
                </div>
                <div className="flex items-center text-gray-500 dark:text-gray-400">→</div>
                <div className="flex-1">
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    required
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 dark:bg-gray-800 dark:text-white ${
                      formErrors.endTime
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:focus:border-red-500"
                        : "border-gray-300 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-400"
                    }`}
                  />
                </div>
              </div>

              {/* Quick Time Presets */}
              <div className="mb-3">
                <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">Quick Duration</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyTimePreset(60)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      durationMinutes === 60
                        ? "bg-brand-500 text-white dark:bg-brand-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    1h
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTimePreset(90)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      durationMinutes === 90
                        ? "bg-brand-500 text-white dark:bg-brand-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    1.5h
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTimePreset(120)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      durationMinutes === 120
                        ? "bg-brand-500 text-white dark:bg-brand-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    2h
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTimePreset(180)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      durationMinutes === 180
                        ? "bg-brand-500 text-white dark:bg-brand-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    3h
                  </button>
                </div>
              </div>

              {/* Duration Display */}
              {(formErrors.startTime || formErrors.endTime) && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.startTime || formErrors.endTime}</p>
              )}
              {formData.startTime && formData.endTime && formData.startTime < formData.endTime && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 p-2.5 dark:bg-green-900/20">
                  <TimeIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">
                    Duration: {durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : `${durationMinutes}m`}
                  </p>
                </div>
              )}

              {/* Conflict Warning */}
              {hasConflict && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    Time slot conflicts with an existing booking
                  </p>
                  {nextAvailableSlot && (
                    <div className="mt-2">
                      <p className="text-xs text-red-600 dark:text-red-300">
                        💡 {nextAvailableSlot.reason}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            startTime: nextAvailableSlot.availableStartTime,
                            endTime: "",
                          }));
                          setHasConflict(false);
                          setNextAvailableSlot(null);
                        }}
                        className="mt-2 inline-block rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                      >
                        Apply Suggested Time
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Booked Time Slots Display with Timeline */}
          {formData.resourceId && formData.date && (
            <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-400"></div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  Booked Time Slots for {new Date(formData.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                {isLoadingBookings && <span className="text-xs text-gray-500 dark:text-gray-400">(Loading...)</span>}
              </div>

              {bookedSlots.length > 0 ? (
                <div className="space-y-3">
                  {/* Time Timeline Visualization */}
                  <div className="mb-5 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 p-4 dark:from-gray-900 dark:to-gray-800">
                    <div className="mb-2 flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-400">
                      <span>08:00 (Start)</span>
                      <span>18:00 (End)</span>
                    </div>
                    <div className="relative h-12 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                      {/* Time marks */}
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: 11 }).map((_, i) => (
                          <div key={i} className="flex-1 border-r border-gray-200 last:border-r-0 dark:border-gray-700" />
                        ))}
                      </div>

                      {/* Booked slots */}
                      {bookedSlots.map((slot, idx) => {
                        const startHour = parseInt(slot.start.split(":")[0]);
                        const startMin = parseInt(slot.start.split(":")[1]) || 0;
                        const endHour = parseInt(slot.end.split(":")[0]);
                        const endMin = parseInt(slot.end.split(":")[1]) || 0;

                        const startPercent = ((startHour - 8 + startMin / 60) / 10) * 100;
                        const endPercent = ((endHour - 8 + endMin / 60) / 10) * 100;

                        const isConflicting =
                          formData.startTime &&
                          formData.endTime &&
                          hasTimeConflict(formData.startTime, formData.endTime, slot.start, slot.end);

                        return (
                          <div
                            key={idx}
                            className={`absolute top-1 bottom-1 rounded-md flex items-center justify-center text-xs font-bold text-white transition-all ${
                              isConflicting
                                ? "bg-red-500 dark:bg-red-600 opacity-90 hover:opacity-100"
                                : "bg-orange-400 dark:bg-orange-500 opacity-75 hover:opacity-90"
                            }`}
                            style={{
                              left: `${startPercent}%`,
                              right: `${100 - endPercent}%`,
                              minWidth: "40px",
                            }}
                            title={`${slot.start} - ${slot.end} (${slot.status})`}
                          >
                            {isConflicting ? "❌" : "📌"}
                          </div>
                        );
                      })}

                      {/* Your proposed time */}
                      {formData.startTime && formData.endTime && (
                        <div
                          className="absolute top-1 bottom-1 rounded-md flex items-center justify-center text-xs font-bold text-gray-900 bg-green-300 dark:bg-green-500 dark:text-white opacity-60 border-2 border-dashed border-green-600"
                          style={{
                            left: `${((parseInt(formData.startTime.split(":")[0]) - 8 + (parseInt(formData.startTime.split(":")[1]) || 0) / 60) / 10) * 100}%`,
                            right: `${100 - ((parseInt(formData.endTime.split(":")[0]) - 8 + (parseInt(formData.endTime.split(":")[1]) || 0) / 60) / 10) * 100}%`,
                            minWidth: "40px",
                          }}
                          title="Your proposed booking time"
                        >
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex gap-4 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-orange-400"></div>
                        <span className="text-gray-600 dark:text-gray-400">Booked</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-red-500"></div>
                        <span className="text-gray-600 dark:text-gray-400">Conflict</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-green-300 border border-green-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Your Time</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed slot list */}
                  {bookedSlots.map((slot, idx) => {
                    const isConflicting = formData.startTime && formData.endTime && hasTimeConflict(formData.startTime, formData.endTime, slot.start, slot.end);
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg p-3 text-sm flex items-center justify-between ${
                          isConflicting
                            ? "border-2 border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                            : "border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-lg ${isConflicting ? "text-red-600 dark:text-red-400" : "text-orange-500 dark:text-orange-400"}`}>
                            {isConflicting ? "🚫" : "📌"}
                          </span>
                          <div>
                            <p className={`font-medium ${isConflicting ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-white"}`}>
                              {slot.start} - {slot.end}
                            </p>
                            <p className={`text-xs ${isConflicting ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>
                              Status: {slot.status}
                            </p>
                          </div>
                        </div>
                        {isConflicting && (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700 dark:bg-red-900 dark:text-red-300">
                            CONFLICT
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-green-300 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    ✅ No bookings for this date - All time slots are available!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: EVENT DETAILS */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 p-3 shadow-md">
              <InfoIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Event Details</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Step 3 of 3</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Purpose */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Purpose *</label>
                {formData.purpose && !formErrors.purpose && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
                {formErrors.purpose && <AlertIcon className="h-4 w-4 text-red-500" />}
              </div>
              <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">💡 Describe the purpose of your booking to help administrators understand your needs</p>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                required
                placeholder="e.g., Team meeting for Q1 planning, Final project presentation, Weekly lab experiment"
                rows={3}
                className={`w-full rounded-lg border px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 transition-all dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 ${
                  formErrors.purpose
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500/50 dark:border-red-600"
                    : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/50 dark:border-gray-600"
                }`}
              />
              {formErrors.purpose && <p className="mt-2 text-xs text-red-600 dark:text-red-400">⚠️ {formErrors.purpose}</p>}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {formData.purpose.length > 0 ? `${formData.purpose.length} characters` : "No description yet"}
              </p>
            </div>

            {/* Attendees */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Number of Attendees *</label>
                {selectedResource && formData.attendees <= (selectedResource?.capacity ?? 0) && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
                {selectedResource && formData.attendees > (selectedResource?.capacity ?? 0) && <AlertIcon className="h-4 w-4 text-red-500" />}
              </div>

              {selectedResource ? (
                <div className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <input
                        type="number"
                        name="attendees"
                        value={formData.attendees}
                        onChange={handleChange}
                        required
                        min="1"
                        className={`w-full rounded-lg border px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 transition-all dark:bg-gray-800 dark:text-white ${
                          formData.attendees > (selectedResource?.capacity ?? 0)
                            ? "border-red-300 focus:ring-red-500/50 dark:border-red-600"
                            : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/50 dark:border-gray-600"
                        }`}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">of {selectedResource?.capacity}</span>
                  </div>

                  {/* Enhanced Capacity Bar */}
                  <div className="space-y-2">
                    <div className="relative h-3 overflow-hidden rounded-full bg-gray-200 shadow-inner dark:bg-gray-700">
                      <div
                        className={`h-full transition-all duration-300 ${
                          formData.attendees > (selectedResource?.capacity ?? 0)
                            ? "bg-red-500"
                            : ((selectedResource?.capacity ?? 0) > 0 && (formData.attendees / (selectedResource?.capacity ?? 0)) * 100 > 75)
                              ? "bg-orange-500"
                              : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min((selectedResource?.capacity ?? 0) > 0 ? (formData.attendees / (selectedResource?.capacity ?? 0)) * 100 : 0, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold ${
                        formData.attendees > (selectedResource?.capacity ?? 0)
                          ? "text-red-600 dark:text-red-400"
                          : ((selectedResource?.capacity ?? 0) > 0 && (formData.attendees / (selectedResource?.capacity ?? 0)) * 100 > 75)
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-green-600 dark:text-green-400"
                      }`}>
                        {formData.attendees > (selectedResource?.capacity ?? 0)
                          ? `⚠️ Over capacity by ${formData.attendees - (selectedResource?.capacity ?? 0)}`
                          : `${Math.round(((selectedResource?.capacity ?? 0) > 0 ? formData.attendees / (selectedResource?.capacity ?? 0) : 0) * 100)}% capacity`}
                      </p>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {selectedResource?.capacity && selectedResource.capacity - formData.attendees > 0 ? `${selectedResource.capacity - formData.attendees} seat${selectedResource.capacity - formData.attendees !== 1 ? "s" : ""} left` : "At capacity"}
                      </span>
                    </div>
                  </div>

                  {/* Capacity Warning */}
                  {formData.attendees > (selectedResource?.capacity ?? 0) && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                        ⚠️ Selected attendees exceed the room capacity
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="number"
                  name="attendees"
                  value={formData.attendees}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>

            {/* Recurrence Settings */}
            <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-700">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 p-3 shadow-md">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recurrence</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Schedule booking for multiple dates automatically</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Recurrence Type */}
                <div>
                  <label className="mb-3 block text-sm font-bold text-gray-700 dark:text-gray-300">
                    Repeat Booking
                  </label>
                  <select
                    name="recurrenceType"
                    value={formData.recurrenceType}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="NONE">Don't repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly (same day)</option>
                    <option value="MONTHLY">Monthly (same date)</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    ℹ️ Booking will repeat with the selected frequency
                  </p>
                </div>

                {/* Recurrence End Date - Only show if recurrence is selected */}
                {(formData.recurrenceType as string) !== "NONE" && (
                  <div>
                    <DatePicker
                      label="Repeat Until *"
                      value={formData.recurrenceEndDate || ""}
                      onChange={(date) => {
                        setFormData((prev) => ({
                          ...prev,
                          recurrenceEndDate: date,
                        }));
                      }}
                      minDate={formData.date}
                      error={!!formErrors.recurrenceEndDate}
                      errorMessage={formErrors.recurrenceEndDate}
                      placeholder="Select end date for recurrence"
                      required={(formData.recurrenceType as string) !== "NONE"}
                      showWeekday
                    />
                  </div>
                )}
              </div>

              {/* Recurrence Preview */}
              {(formData.recurrenceType as string) !== "NONE" && formData.date && formData.recurrenceEndDate && (
                <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                      📅 Recurrence Preview
                    </p>
                    <span className="rounded-full bg-purple-200 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      {recurrenceCount} booking{recurrenceCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-300">
                    {formData.recurrenceType === "DAILY" && `This booking will repeat every day from ${new Date(formData.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(formData.recurrenceEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    {formData.recurrenceType === "WEEKLY" && `This booking will repeat every week on ${new Date(formData.date).toLocaleDateString("en-US", { weekday: "long" })} from ${new Date(formData.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(formData.recurrenceEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    {formData.recurrenceType === "MONTHLY" && `This booking will repeat on day ${new Date(formData.date).getDate()} of each month from ${new Date(formData.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(formData.recurrenceEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOOKING PREVIEW CARD - Enhanced */}
        {formData.resourceId && formData.date && (
          <div className="rounded-xl border-2 border-brand-300 bg-gradient-to-br from-brand-50 via-blue-50 to-brand-50 p-7 shadow-lg dark:border-brand-700 dark:from-brand-950/50 dark:via-gray-900 dark:to-brand-950/30">
            <div className="mb-5 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Booking Summary</h3>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-start justify-between rounded-lg bg-white/80 p-3 dark:bg-gray-800/50">
                <div className="flex gap-3 flex-1">
                  <div className="rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 p-2.5 flex-shrink-0 dark:from-brand-900/50 dark:to-gray-800">
                    {assetTypeConfig[selectedResource?.type || ""]?.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">RESOURCE</p>
                    <p className="font-bold text-gray-900 dark:text-white">{selectedResource?.name}</p>
                  </div>
                </div>
                <span className="rounded-full bg-gradient-to-r from-brand-100 to-blue-100 px-3 py-1 text-xs font-bold text-brand-700 dark:from-brand-900 dark:to-blue-900 dark:text-brand-300">
                  {selectedResource?.capacity}p
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2 rounded-lg bg-white/80 p-3 dark:bg-gray-800/50">
                  <CalenderIcon className="h-4 w-4 flex-shrink-0 text-brand-600 dark:text-brand-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">DATE</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {new Date(formData.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 rounded-lg bg-white/80 p-3 dark:bg-gray-800/50">
                  <TimeIcon className="h-4 w-4 flex-shrink-0 text-brand-600 dark:text-brand-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">TIME</p>
                    <p className="font-bold text-gray-900 dark:text-white">{formData.startTime} - {formData.endTime}</p>
                  </div>
                </div>
                <div className="flex gap-2 rounded-lg bg-white/80 p-3 dark:bg-gray-800/50">
                  <UserIcon className="h-4 w-4 flex-shrink-0 text-brand-600 dark:text-brand-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">ATTENDEES</p>
                    <p className="font-bold text-gray-900 dark:text-white">{formData.attendees} {formData.attendees === 1 ? "person" : "people"}</p>
                  </div>
                </div>
                <div className="flex gap-2 rounded-lg bg-white/80 p-3 dark:bg-gray-800/50">
                  <div className="h-4 w-4 flex-shrink-0 text-yellow-500 mt-0.5 text-lg">📋</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">STATUS</p>
                    <p className="font-bold text-yellow-600 dark:text-yellow-400">PENDING</p>
                  </div>
                </div>
              </div>

              {/* Purpose Section */}
              <div className="border-t border-brand-200 pt-4 dark:border-brand-900/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">PURPOSE</p>
                <p className="mt-1 text-gray-900 dark:text-gray-200">{formData.purpose || "Not specified yet"}</p>
              </div>

              {/* Location info */}
              <div className="rounded-lg bg-brand-100/40 p-2.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 flex items-center gap-2">
                <span>📍</span>
                <span>{selectedResource?.location}</span>
              </div>
            </div>
          </div>
        )}

        {/* SUBMIT BUTTONS - Enhanced */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedAssetType("");
              setResourceSearchQuery("");
              setFormData({
                resourceId: "",
                date: "",
                startTime: "",
                endTime: "",
                purpose: "",
                attendees: 1,
                recurrenceType: "NONE",
                recurrenceEndDate: "",
              });
              setFormErrors({});
            }}
            className="flex-1 font-semibold"
          >
            🔄 Clear Form
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || completionPercentage < 100}
            className={`flex-1 font-semibold text-base py-3 transition-all ${completionPercentage < 100 ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg"}`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                Creating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ✅ {completionPercentage === 100 ? "Create Booking" : "Complete Required Fields"}
              </span>
            )}
          </Button>
        </div>

        {/* Helpful Information Footer */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">ℹ️ Important Information</p>
          <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-300">
            <li>• Your booking will be in <strong>PENDING</strong> status until approved by an administrator</li>
            <li>• You'll receive a notification once your booking is approved or rejected</li>
            <li>• Capacity warnings indicate potential conflicts with room limits</li>
            <li>• View your bookings in the "My Bookings" tab</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
