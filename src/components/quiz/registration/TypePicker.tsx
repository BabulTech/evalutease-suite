const TYPE_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "teacher", label: "Teacher", emoji: "📚" },
  { value: "employee", label: "Employee", emoji: "💼" },
  { value: "fun", label: "Fun / Guest", emoji: "🎉" },
];

type Props = {
  value: string;
  onChange: (type: string) => void;
};

export function TypePicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="mb-2 block text-xs text-muted-foreground font-medium">I am a…</p>
      {/* react-doctor-disable-next-line react-doctor/prefer-tag-over-role */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Participant type">
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? "" : o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
              value === o.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {o.emoji} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
