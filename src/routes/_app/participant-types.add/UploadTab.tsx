import { useRef, useState } from "react";
import { FileText, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ParticipantDraftReview } from "@/components/participants/ParticipantDraftReview";
import { parseParticipantsCsv } from "@/components/participants/parser";
import type { ParticipantDraft } from "@/components/participants/types";
import { MAX_CSV } from "./types";

export function UploadTab({
  typeId,
  onSave,
}: {
  typeId: string;
  onSave: (drafts: ParticipantDraft[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [drafts, setDrafts] = useState<ParticipantDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_CSV) {
      validationError("File too large (max 1 MB)");
      return;
    }
    const isText = file.type.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
    if (!isText) {
      validationError("Only CSV, TSV, or plain-text files are accepted");
      return;
    }
    setText(await file.text());
    setFilename(file.name);
    toast.success(`Loaded ${file.name}`);
  };

  const parse = () => {
    const out = parseParticipantsCsv(text);
    if (!out.length) {
      toast.error("No rows with a name found - check your header row");
      return;
    }
    setDrafts(out);
    toast.success(`${out.length} participant${out.length === 1 ? "" : "s"} parsed`);
  };

  const handleSave = async () => {
    if (!drafts.length) return;
    const bad = drafts.findIndex((d) => !d.name.trim());
    if (bad >= 0) {
      toast.error(`Row ${bad + 1} is missing a name`);
      return;
    }
    setSaving(true);
    try {
      await onSave(drafts);
      setDrafts([]);
      setText("");
      setFilename("");
    } finally {
      setSaving(false);
    }
  };

  if (!typeId)
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
        <Upload className="mx-auto size-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{t("ptAdd.selectTypeUpload")}</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a CSV or Excel-exported CSV. Recognised columns:{" "}
        {["name", "email", "mobile", "roll_number", "class", "organization"].map((c) => (
          <span key={c} className="font-mono text-foreground text-xs">
            {c}{" "}
          </span>
        ))}
        . Only <span className="font-mono text-foreground text-xs">name</span> is required.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/plain"
        className="hidden"
        aria-label="Upload CSV file"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-8 text-center cursor-pointer transition-colors w-full"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        aria-label={filename ? `Loaded: ${filename}` : t("ptAdd.chooseFile")}
      >
        <FileText className="mx-auto size-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium">
          {filename ? `Loaded: ${filename}` : t("ptAdd.chooseFile")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{t("ptAdd.dragDrop")}</div>
      </button>

      <div>
        <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {t("ptAdd.pasteEdit")}
        </Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"name,email,roll_number,class\nAli Khan,ali@example.com,2026-CS-01,Class 9"}
          className="min-h-[140px] font-mono text-xs"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => fileRef.current?.click()} className="gap-2">
          <Upload className="size-4" /> {t("ptAdd.chooseFileBtn")}
        </Button>
        <Button
          onClick={parse}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {t("ptAdd.parseRows")}
        </Button>
      </div>

      <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}>
            <X className="size-4 mr-1" /> {t("ptAdd.discard")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !drafts.length}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Save className="size-4" />
            {saving ? t("ptAdd.saving") : `${t("ptAdd.saveAll")} (${drafts.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
