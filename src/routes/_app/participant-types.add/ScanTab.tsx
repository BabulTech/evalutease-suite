import { useRef, useState } from "react";
import { Image as ImageIcon, Save, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticipantDraftReview } from "@/components/participants/ParticipantDraftReview";
import type { ParticipantDraft } from "@/components/participants/types";
import { SUPPORTED_IMG, MAX_IMG, type SupportedMediaType } from "./types";

export function ScanTab({
  typeId,
  onSave,
}: {
  typeId: string;
  onSave: (drafts: ParticipantDraft[]) => Promise<void>;
  // react-doctor-disable-next-line react-doctor/prefer-useReducer
}) {
  const { t } = useI18n();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const imageBase64Ref = useRef("");
  const mediaTypeRef = useRef<SupportedMediaType | null>(null);
  const [hint, setHint] = useState("");
  const [drafts, setDrafts] = useState<ParticipantDraft[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImageName("");
    imageBase64Ref.current = "";
    mediaTypeRef.current = null;
    setHint("");
    setDrafts([]);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!SUPPORTED_IMG.includes(file.type as SupportedMediaType)) {
      validationError("JPG, PNG, GIF, or WebP only");
      return;
    }
    if (file.size > MAX_IMG) {
      validationError("Image too large (max 5 MB)");
      return;
    }
    const url = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      imageBase64Ref.current = (e.target?.result as string).split(",")[1] ?? "";
    };
    reader.readAsDataURL(file);
    setImageUrl(url);
    setImageName(file.name);
    mediaTypeRef.current = file.type as SupportedMediaType;
    setDrafts([]);
  };

  const extract = async () => {
    if (!imageBase64Ref.current || !mediaTypeRef.current) {
      toast.error("Load an image first");
      return;
    }
    setExtracting(true);
    try {
      const { extractParticipantsFromImage } = await import("@/components/participants/ai.server");
      const out = await extractParticipantsFromImage({
        data: {
          imageBase64: imageBase64Ref.current,
          mediaType: mediaTypeRef.current,
          hint: hint || undefined,
        },
      });
      if (!out.length) {
        toast.error("No participants found in the image");
        return;
      }
      setDrafts(out);
      toast.success(`${out.length} participant${out.length === 1 ? "" : "s"} extracted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!drafts.length) return;
    setSaving(true);
    try {
      await onSave(drafts);
      reset();
    } finally {
      setSaving(false);
    }
  };

  if (!typeId)
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
        <ScanLine className="mx-auto size-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{t("ptAdd.selectTypeScan")}</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("ptAdd.scanDesc")}</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        aria-label="Upload image for scanning"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-6 text-center cursor-pointer transition-colors w-full"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        aria-label={imageUrl ? imageName : t("ptAdd.clickImage")}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageName}
            className="mx-auto max-h-48 rounded-xl object-contain"
          />
        ) : (
          <>
            <ImageIcon className="mx-auto size-10 text-muted-foreground/60" />
            <div className="mt-3 text-sm font-medium">{t("ptAdd.clickImage")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("ptAdd.imgFormats")}</div>
          </>
        )}
      </button>

      {imageUrl && (
        <div>
          <Label className="mb-1.5 text-sm">
            {t("ptAdd.hintForAi")}{" "}
            <span className="text-muted-foreground font-normal">({t("ptAdd.groupOptional")})</span>
          </Label>
          <Input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder='e.g. "Class 10-A attendance sheet, columns: name, roll no, class"'
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {imageUrl && (
          <Button variant="ghost" onClick={reset} disabled={extracting || saving}>
            <X className="size-4 mr-1" /> {t("ptAdd.clear")}
          </Button>
        )}
        <Button
          onClick={extract}
          disabled={!imageUrl || extracting}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <ScanLine className="size-4" />
          {extracting ? t("ptAdd.extracting") : t("ptAdd.extractParticipants")}
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
            disabled={saving}
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
