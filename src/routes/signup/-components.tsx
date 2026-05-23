import React from "react";
import { Check } from "lucide-react";

export function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-glow"
          : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {active && <Check size={12} />}
      {children}
    </button>
  );
}

// react-doctor-disable-next-line react-doctor/no-multi-comp
export function RoleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] flex-1 rounded-xl border text-sm font-semibold transition-all px-3 py-2 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-glow"
          : "bg-secondary/30 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// react-doctor-disable-next-line react-doctor/no-multi-comp
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}
