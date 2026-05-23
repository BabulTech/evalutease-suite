import React from "react";
import { Logo } from "@/components/Logo";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
