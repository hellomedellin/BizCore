import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Short, muted helper text shown under a field or section heading.
export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-slate-500", className)}>{children}</p>;
}

// A small "i" icon that reveals an explanation on hover/focus — for inline help
// next to labels without cluttering the layout.
export function InfoTip({ text }: { text: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button type="button" aria-label="More information" className="inline-flex text-slate-400 transition-colors hover:text-slate-600">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={5}
            className="z-50 max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-relaxed text-white shadow-md"
          >
            {text}
            <TooltipPrimitive.Arrow className="fill-slate-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
