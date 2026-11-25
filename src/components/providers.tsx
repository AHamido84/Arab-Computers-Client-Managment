"use client";

import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ dir, children }: { dir: "rtl" | "ltr"; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DirectionProvider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors position={dir === "rtl" ? "top-left" : "top-right"} dir={dir} />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
