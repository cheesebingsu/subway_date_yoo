import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

export function MobileLayout({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex justify-center min-h-screen bg-muted/30">
      <div 
        className={cn(
          "w-full max-w-[430px] min-h-screen bg-base relative shadow-md flex flex-col",
          className
        )}
        {...props}
      >
        {children}
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#F7F3EC', color: '#2D2A24', border: '1px solid #E5DFD3' } }} />
      </div>
    </div>
  );
}
