export function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-24 rounded-xl md:rounded-2xl bg-muted/40" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 rounded-xl bg-muted/30" />
        <div className="h-20 rounded-xl bg-muted/30" />
        <div className="h-20 rounded-xl bg-muted/30" />
      </div>
      <div className="h-64 rounded-xl md:rounded-2xl bg-muted/40" />
      <div className="h-40 rounded-xl md:rounded-2xl bg-muted/30" />
    </div>
  );
}
