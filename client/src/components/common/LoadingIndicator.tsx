import { twMerge } from "tailwind-merge";

type LoadingIndicatorProps = {
  label?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  layout?: "inline" | "stacked";
  tone?: "brand" | "inverse";
  className?: string;
};

const shellSizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-11 w-11",
} as const;

const coreSizeClasses = {
  sm: "inset-[3px]",
  md: "inset-[6px]",
  lg: "inset-[8px]",
} as const;

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

const dotSizeClasses = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-2 w-2",
} as const;

const toneClasses = {
  brand: {
    outer: "border-brand-200/80 dark:border-brand-500/20",
    spinner: "border-t-brand-500 border-r-brand-400",
    core: "bg-brand-500/15 dark:bg-brand-400/20",
    title: "text-gray-800 dark:text-white/90",
    description: "text-gray-500 dark:text-gray-400",
    dot: "bg-brand-500/70 dark:bg-brand-400/80",
  },
  inverse: {
    outer: "border-white/30",
    spinner: "border-t-white border-r-white/80",
    core: "bg-white/20",
    title: "text-white",
    description: "text-white/80",
    dot: "bg-white/85",
  },
} as const;

export default function LoadingIndicator({
  label,
  description,
  size = "md",
  layout = "inline",
  tone = "brand",
  className,
}: LoadingIndicatorProps) {
  const palette = toneClasses[tone];
  const srLabel = label ?? "Loading";

  return (
    <div
      role="status"
      aria-live="polite"
      className={twMerge(
        layout === "stacked"
          ? "flex flex-col items-center justify-center gap-3 text-center"
          : "flex items-center gap-2",
        className
      )}
    >
      <span
        className={twMerge(
          "relative inline-flex shrink-0 rounded-full",
          shellSizeClasses[size]
        )}
        aria-hidden="true"
      >
        <span
          className={twMerge("absolute inset-0 rounded-full border-2", palette.outer)}
        />
        <span
          className={twMerge(
            "absolute inset-0 rounded-full border-2 border-transparent animate-spin",
            palette.spinner
          )}
        />
        <span
          className={twMerge(
            "loader-core-pulse absolute rounded-full",
            coreSizeClasses[size],
            palette.core
          )}
        />
      </span>

      {label || description ? (
        <div className={layout === "stacked" ? "space-y-1" : "min-w-0"}>
          {label ? (
            <p className={twMerge("font-medium", textSizeClasses[size], palette.title)}>
              {label}
            </p>
          ) : null}

          {description ? (
            <p className={twMerge("text-xs", palette.description)}>{description}</p>
          ) : null}

          {layout === "stacked" ? (
            <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
              <span
                className={twMerge("loader-dot rounded-full", dotSizeClasses[size], palette.dot)}
              />
              <span
                className={twMerge(
                  "loader-dot loader-dot-delay-1 rounded-full",
                  dotSizeClasses[size],
                  palette.dot
                )}
              />
              <span
                className={twMerge(
                  "loader-dot loader-dot-delay-2 rounded-full",
                  dotSizeClasses[size],
                  palette.dot
                )}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <span className="sr-only">{srLabel}</span>
    </div>
  );
}
