import React from "react";
import { Logo } from "@/components/Logo";

export function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Logo />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-10">{children}</main>
    </div>
  );
}
