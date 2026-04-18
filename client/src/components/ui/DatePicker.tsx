import React from "react";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.min.css";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  label?: string;
  required?: boolean;
  showWeekday?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Select a date",
  disabled = false,
  error = false,
  errorMessage,
  label,
  required = false,
  showWeekday = false,
}) => {
  const handleDateChange = (selectedDates: Date[]) => {
    if (selectedDates.length > 0) {
      const date = selectedDates[0];
      const formattedDate = date.toISOString().split("T")[0];
      onChange(formattedDate);
    }
  };

  const parsedDate = value ? new Date(value) : null;

  // Calculate constraints for flatpickr
  const minDateObj = minDate ? new Date(minDate) : new Date();
  const maxDateObj = maxDate ? new Date(maxDate) : undefined;

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}

      <div className="relative">
        <Flatpickr
          value={parsedDate || ""}
          onChange={handleDateChange}
          options={{
            minDate: minDateObj,
            maxDate: maxDateObj,
            dateFormat: "Y-m-d",
            mode: "single",
            monthSelectorType: "dropdown",
            enableTime: false,
            disableMobile: false,
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-lg border px-4 py-3 text-gray-900 transition-all focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-white ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/50 dark:border-red-600"
              : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/50 dark:border-gray-600"
          } ${disabled ? "cursor-not-allowed bg-gray-100 dark:bg-gray-900" : ""}`}
        />

        {/* Calendar Icon */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      {/* Error Message */}
      {error && errorMessage && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          ⚠️ {errorMessage}
        </p>
      )}

      {/* Selected Date Info */}
      {value && !error && showWeekday && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          📅 {new Date(value).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      {/* Flatpickr Custom Styles */}
      <style>{`
        .flatpickr-calendar {
          background: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          border: none;
          max-width: 320px;
        }

        .dark .flatpickr-calendar {
          background: #1f2937;
          color: #f3f4f6;
        }

        .flatpickr-month {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border-radius: 8px 8px 0 0;
          padding: 10px;
        }

        .dark .flatpickr-month {
          background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
        }

        .flatpickr-prev-month,
        .flatpickr-next-month {
          color: white;
          fill: white;
          padding: 6px;
        }

        .flatpickr-prev-month:hover,
        .flatpickr-next-month:hover {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        .flatpickr-current-month {
          color: white;
          font-weight: 600;
          font-size: 14px;
        }

        .flatpickr-innerContainer {
          background: white;
          border-radius: 0 0 8px 8px;
        }

        .dark .flatpickr-innerContainer {
          background: #1f2937;
        }

        .flatpickr-weekdaycontainer {
          background: #f9fafb;
        }

        .dark .flatpickr-weekdaycontainer {
          background: #111827;
        }

        .flatpickr-weekday {
          color: #6b7280;
          font-weight: 600;
          font-size: 12px;
        }

        .dark .flatpickr-weekday {
          color: #9ca3af;
        }

        .flatpickr-day {
          color: #374151;
          font-size: 14px;
          transition: all 0.2s;
        }

        .dark .flatpickr-day {
          color: #d1d5db;
        }

        .flatpickr-day:hover,
        .flatpickr-day.prevMonthDay:hover,
        .flatpickr-day.nextMonthDay:hover {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #2563eb;
          border-radius: 4px;
        }

        .dark .flatpickr-day:hover {
          background: #1e3a8a;
          color: #93c5fd;
        }

        .flatpickr-day.selected {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
          font-weight: 600;
          border-radius: 4px;
        }

        .flatpickr-day.today {
          border-color: #3b82f6;
          color: #3b82f6;
          font-weight: 600;
        }

        .dark .flatpickr-day.today {
          color: #60a5fa;
          border-color: #60a5fa;
        }

        .flatpickr-day.disabled,
        .flatpickr-day.prevMonthDay,
        .flatpickr-day.nextMonthDay {
          color: #d1d5db;
          background: #f3f4f6;
        }

        .dark .flatpickr-day.disabled,
        .dark .flatpickr-day.prevMonthDay,
        .dark .flatpickr-day.nextMonthDay {
          background: #111827;
          color: #6b7280;
        }

        .flatpickr-months {
          gap: 0;
        }

        .flatpickr-month {
          margin: 0;
        }

        /* Dropdown styles */
        .flatpickr-monthDropdown-months,
        .flatpickr-monthDropdown-months:hover {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 6px center;
          background-size: 18px;
          color: white;
          padding-right: 32px;
        }

        .flatpickr-monthDropdown-months {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          padding: 5px 8px;
          color: white;
          font-weight: 500;
        }

        .flatpickr-monthDropdown-months option {
          background: #1f2937;
          color: #f3f4f6;
        }

        /* Year input */
        .flatpickr-year {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          color: white;
          padding: 5px 8px;
          font-weight: 500;
        }

        .flatpickr-year:focus {
          border-color: rgba(255, 255, 255, 0.5);
        }

        /* Animation */
        .flatpickr-calendar.animate {
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default DatePicker;
