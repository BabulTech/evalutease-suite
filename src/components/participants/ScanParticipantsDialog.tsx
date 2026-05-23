import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ParticipantDraftReview } from "./ParticipantDraftReview";
import { extractParticipantsFromImage } from "./ai.server";
import { type ParticipantDraft } from "./types";
import { usePlan } from "@/contexts/PlanContext";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { UpgradePrompt } from "./scan-dialog/UpgradePrompt";
import { ImageUploadZone } from "./scan-dialog/ImageUploadZone";
import { ScanControls } from "./scan-dialog/ScanControls";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED: SupportedMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Props = {
  trigger: ReactNode;
  onSave: (drafts: ParticipantDraft[]) => Promise<void>;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function ScanParticipantsDialog({ trigger, onSave }: Props) {
  const { user } = useAuth();
  const { plan, credits, reload, isAiAllowed } = usePlan();
  const creditCost = plan?.credit_cost_ai_scan ?? 2;

  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
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
    setImageBase64("");
    mediaTypeRef.current = null;
    setHint("");
    setDrafts([]);
    setExtracting(false);
    setSaving(false);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!SUPPORTED.includes(file.type as SupportedMediaType)) {
      toast.error("Please choose a JPG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setImageName(file.name);
    mediaTypeRef.current = file.type as SupportedMediaType;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      setImageBase64(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => toast.error("Could not read the image file.");
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!imageBase64 || !mediaTypeRef.current) {
      toast.error("Upload an image first.");
      return;
    }
    if (!user) return;
    if (credits.balance < creditCost) {
      toast.error(
        `Not enough credits. Need ${creditCost}, you have ${credits.balance}. Buy more in Billing.`,
      );
      return;
    }
    setExtracting(true);
    try {
      const { data: deducted, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_type: "ai_image_scan",
        p_description: "AI scan to extract participants from image",
      });
      if (deductErr || !deducted) {
        toast.error("Credit deduction failed. " + (deductErr?.message ?? "Insufficient credits."));
        return;
      }
      reload();
      const out = await extractParticipantsFromImage({
        data: { imageBase64, mediaType: mediaTypeRef.current, hint: hint.trim() },
      });
      if (out.length === 0) {
        toast.error("Claude couldn't find any participants in the image. Try a clearer scan.");
        return;
      }
      setDrafts(out);
      toast.success(
        `Extracted ${out.length} participant${out.length === 1 ? "" : "s"} · ${creditCost} credits used`,
      );
    } catch (err) {
      toast.error((err as Error)?.message ?? "Image extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (drafts.length === 0) return;
    const missingName = drafts.findIndex((d) => !d.name.trim());
    if (missingName >= 0) {
      toast.error(`Row ${missingName + 1} is missing a name`);
      return;
    }
    setSaving(true);
    try {
      await onSave(drafts);
      reset();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        {!isAiAllowed ? (
          <UpgradePrompt />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Scan participants from an image</DialogTitle>
              <DialogDescription>
                Upload a photo of a class roster, attendance sheet, or list. Claude will read it and
                return editable participant drafts. Costs <strong>{creditCost} credits</strong> per
                scan (you have <strong>{credits.balance}</strong>).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <ImageUploadZone
                  imageUrl={imageUrl}
                  imageName={imageName}
                  fileRef={fileRef}
                  onFile={handleFile}
                />
                <ScanControls
                  hint={hint}
                  onHintChange={setHint}
                  fileRef={fileRef}
                  onExtract={extract}
                  extracting={extracting}
                  canExtract={!!imageBase64 && credits.balance >= creditCost}
                  creditCost={creditCost}
                />
              </div>
              <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />
            </div>

            <DialogFooter>
              {drafts.length > 0 && (
                <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}>
                  <X className="size-4 mr-1" /> Discard parsed
                </Button>
              )}
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || drafts.length === 0}
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Save className="size-4" />
                {saving ? "Saving…" : `Save all (${drafts.length})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
