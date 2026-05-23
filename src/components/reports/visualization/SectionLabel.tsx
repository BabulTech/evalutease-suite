export function SectionLabel({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pt-1">
      <div className="h-6 w-1 rounded-full bg-primary mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
