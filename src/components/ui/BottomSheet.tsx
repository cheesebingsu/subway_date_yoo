"use client";

import { HTMLAttributes, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface BottomSheetProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, children, className, ...props }: BottomSheetProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      const timer = setTimeout(() => setIsRendered(false), 300); // Wait for transition
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isRendered) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Overlay */}
      <div 
        className={cn(
          "absolute inset-0 bg-[#2D2A24]/40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sheet */}
      <div
        className={cn(
          "relative w-full max-w-[430px] mx-auto bg-base rounded-t-[24px] shadow-lg transition-transform duration-300 p-6 overscroll-none animate-in slide-in-from-bottom",
          isOpen ? "translate-y-0" : "translate-y-full",
          className
        )}
        {...props}
      >
        {/* Handle for swipe metaphor */}
        <div className="mx-auto w-12 h-[5px] rounded-full bg-border-default mb-6" />
        {children}
      </div>
    </div>
  );
}
