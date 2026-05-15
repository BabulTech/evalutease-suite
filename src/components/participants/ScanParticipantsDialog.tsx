import { useRef, useState, type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Save, ScanLine, Upload, X, Coins, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ParticipantDraftReview } from "./ParticipantDraftReview";
import { extractParticipantsFromImage } from "./ai.server";
import { type ParticipantDraft } from "./types";
import { usePlan } from "@/contexts/PlanContext";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED: SupportedMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Props = {
  trigger: ReactNode;
  onSave: (drafts: ParticipantDraft[]) => Promise<void>;
};

export function ScanParticipantsDialog({ trigger, onSave }: Props) {
  const { user } = useAuth();
  const { plan, credits, reload, isAiAllowed } = usePlan();
  const creditCost = plan?.credit_cost_ai_scan ?? 2;
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mediaType, setMediaType] = useState<SupportedMediaType | null>(null);
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
    setMediaType(null);
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
    setMediaType(file.type as SupportedMediaType);
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
    if (!imageBase64 || !mediaType) {
      toast.error("Upload an image first.");
      return;
    }
    if (!user) return;
    if (credits.balance < creditCost) {
      toast.error(`Not enough credits. Need ${creditCost}, you have ${credits.balance}. Buy more in Billing.`);
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
        data: { imageBase64, mediaType, hint: hint.trim() },
      });
      if (out.length === 0) {
        toast.error("Claude couldn't find any participants in the image. Try a clearer scan.");
        return;
      }
      setDrafts(out);
      toast.success(`Extracted ${out.length} participant${out.length === 1 ? "" : "s"} · ${creditCost} credits used`);
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
          <div className="py-10 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
              <ScanLine className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="font-display font-bold text-lg">AI Scan Requires a Paid Plan</div>
              <div className="text-sm text-muted-foreground mt-1">Upgrade to Individual Pro or higher to scan rosters with AI.</div>
            </div>
            <a href="/billing" className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity">
              <Zap className="h-4 w-4" /> Upgrade to Pro
            </a>
          </div>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle>Scan participants from an image</DialogTitle>
          <DialogDescription>
            Upload a photo of a class roster, attendance sheet, or list. Claude will read it and
            return editable participant drafts. Costs <strong>{creditCost} credits</strong> per scan (you have <strong>{credits.balance}</strong>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Image</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                title="Upload participant roster image"
                aria-label="Upload participant roster image"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <div
                className="relative rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 min-h-[220px] flex items-center justify-center overflow-hidden transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                aria-label="Click to upload image"
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={imageName} className="max-h-[360px] w-full object-contain" />
                ) : (
                  <div className="text-center p-6">
                    <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <div className="mt-3 text-sm font-medium">Click to upload an image</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG, GIF, or WebP - up to 5 MB
                    </div>
                  </div>
                )}
              </div>
              {imageUrl && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{imageName}</span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => fileRef.current?.click()}
                  >
                    Replace
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Notes for Claude (optional)
              </Label>
              <Textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={
                  "Anything Claude should know - e.g. 'class 9-A roll-call sheet, names in column 2', 'ignore signatures'…"
                }
                className="min-h-[160px] text-sm"
              />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" /> Image
                </Button>
                <Button
                  type="button"
                  onClick={extract}
                  disabled={extracting || !imageBase64 || credits.balance < creditCost}
                  className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow flex-1"
                >
                  <ScanLine className="h-4 w-4" />
                  {extracting ? "Reading…" : `Extract (${creditCost} cr)`}
                </Button>
              </div>
            </div>
          </div>

          <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />
        </div>

        <DialogFooter>
          {drafts.length > 0 && (
            <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Discard parsed
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
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : `Save all (${drafts.length})`}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
