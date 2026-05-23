import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Save, Upload, X } from "lucide-react";
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
import { parseParticipantsCsv } from "./parser";
import { type ParticipantDraft } from "./types";
import { CsvDropZone } from "./upload-dialog/CsvDropZone";

const MAX_BYTES = 1024 * 1024;

type Props = {
  trigger: ReactNode;
  onSave: (drafts: ParticipantDraft[]) => Promise<void>;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function UploadParticipantsDialog({ trigger, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string>("");
  const [drafts, setDrafts] = useState<ParticipantDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setFilename("");
    setDrafts([]);
    setSaving(false);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 1 MB. Trim it down or paste the content directly.");
      return;
    }
    const isText = file.type.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
    if (!isText) {
      toast.error("Only CSV, TSV, or plain-text files are supported.");
      return;
    }
    const content = await file.text();
    setText(content);
    setFilename(file.name);
    toast.success(`Loaded ${file.name}`);
  };

  const parse = () => {
    const out = parseParticipantsCsv(text);
    if (out.length === 0) {
      toast.error("Couldn't find any rows with a name. Check the header row and try again.");
      return;
    }
    setDrafts(out);
    toast.success(`${out.length} participant${out.length === 1 ? "" : "s"} parsed`);
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
        <DialogHeader>
          <DialogTitle>Upload participants</DialogTitle>
          <DialogDescription>
            Drop a CSV (or TSV) with a header row. Recognised columns:{" "}
            <span className="font-mono">name</span>, <span className="font-mono">email</span>,{" "}
            <span className="font-mono">mobile</span>,{" "}
            <span className="font-mono">roll_number</span>,{" "}
            <span className="font-mono">seat_number</span>, <span className="font-mono">class</span>
            , <span className="font-mono">organization</span>,{" "}
            <span className="font-mono">address</span>, <span className="font-mono">notes</span>.
            Only <span className="font-mono">name</span> is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CsvDropZone filename={filename} fileRef={fileRef} onFile={handleFile} />

          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              File contents
            </Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "name,email,roll_number,class\nAli Khan,ali@example.com,2026-CS-01,Class 9\nHasan Raza,,2026-CS-02,Class 9"
              }
              className="min-h-[180px] font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <Upload className="size-4" /> File
            </Button>
            <Button
              type="button"
              onClick={parse}
              className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              Parse
            </Button>
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
      </DialogContent>
    </Dialog>
  );
}
