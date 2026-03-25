import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { twMerge } from "tailwind-merge";
import {
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  ErrorIcon,
  InfoIcon,
} from "../../icons";

type NotificationVariant = "success" | "error" | "warning" | "info";

type NotificationOptions = {
  title: string;
  message?: string;
  variant?: NotificationVariant;
  durationMs?: number;
};

type NotificationItem = NotificationOptions & {
  id: string;
  variant: NotificationVariant;
  durationMs: number;
};

type NotificationContextValue = {
  showNotification: (options: NotificationOptions) => void;
  dismissNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const defaultDurationMs = 4500;
const maxNotifications = 4;

const notificationStyles = {
  success: {
    panel:
      "border-success-200/80 bg-white text-gray-800 dark:border-success-500/30 dark:bg-gray-900 dark:text-white/90",
    iconWrap:
      "bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-400",
    icon: CheckCircleIcon,
    accent: "bg-success-500",
  },
  error: {
    panel:
      "border-error-200/80 bg-white text-gray-800 dark:border-error-500/30 dark:bg-gray-900 dark:text-white/90",
    iconWrap:
      "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
    icon: ErrorIcon,
    accent: "bg-error-500",
  },
  warning: {
    panel:
      "border-orange-200/80 bg-white text-gray-800 dark:border-orange-500/30 dark:bg-gray-900 dark:text-white/90",
    iconWrap:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
    icon: AlertIcon,
    accent: "bg-orange-500",
  },
  info: {
    panel:
      "border-brand-200/80 bg-white text-gray-800 dark:border-brand-500/30 dark:bg-gray-900 dark:text-white/90",
    iconWrap:
      "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
    icon: InfoIcon,
    accent: "bg-brand-500",
  },
} as const;

const buildNotificationId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const dismissNotification = (id: string) => {
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }

    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== id)
    );
  };

  const showNotification = ({
    title,
    message,
    variant = "info",
    durationMs = defaultDurationMs,
  }: NotificationOptions) => {
    const id = buildNotificationId();
    const notification: NotificationItem = {
      id,
      title,
      message,
      variant,
      durationMs,
    };

    setNotifications((currentNotifications) =>
      [...currentNotifications, notification].slice(-maxNotifications)
    );

    if (durationMs > 0) {
      const timeoutId = window.setTimeout(() => {
        dismissNotification(id);
      }, durationMs);

      timeoutsRef.current.set(id, timeoutId);
    }
  };

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, dismissNotification }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[110000] flex justify-center px-4 sm:justify-end sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-3">
          {notifications.map((notification) => {
            const styles = notificationStyles[notification.variant];
            const Icon = styles.icon;

            return (
              <div
                key={notification.id}
                role={notification.variant === "error" ? "alert" : "status"}
                className={twMerge(
                  "pointer-events-auto relative overflow-hidden rounded-2xl border shadow-lg shadow-gray-950/10 backdrop-blur-sm dark:shadow-black/30",
                  styles.panel
                )}
              >
                <span className={twMerge("absolute inset-x-0 top-0 h-1", styles.accent)} />

                <div className="flex items-start gap-3 px-4 pb-4 pt-5">
                  <div
                    className={twMerge(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      styles.iconWrap
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-semibold">{notification.title}</p>
                    {notification.message ? (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {notification.message}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissNotification(notification.id)}
                    className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
                    aria-label="Dismiss notification"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used inside a NotificationProvider.");
  }

  return context;
};
