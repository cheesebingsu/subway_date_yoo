import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "purple" | "warm" | "gray";
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "purple", children, ...props }, ref) => {
    const variants = {
      purple: "bg-primary-light text-primary-dark",
      warm: "bg-ticket-light text-ticket",
      gray: "bg-muted text-text-secondary",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold select-none",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
