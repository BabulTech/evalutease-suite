export function Logo({
  size = "md",
  customLogoUrl,
}: {
  size?: "sm" | "md" | "lg";
  customLogoUrl?: string | null;
}) {
  if (customLogoUrl) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={customLogoUrl}
          alt="Logo"
          className={`object-contain ${size === "sm" ? "h-12 max-w-[96px]" : size === "lg" ? "h-16 max-w-[180px]" : "h-14 max-w-[140px]"}`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <img
        src="/jancho_logo_512.svg"
        alt="Jancho"
        className={`object-contain ${size === "sm" ? "h-12 w-12" : size === "lg" ? "h-18 w-18" : "h-16 w-16"}`}
      />
    </div>
  );
}
