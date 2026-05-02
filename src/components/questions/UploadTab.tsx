import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraftReview } from "./DraftReview";
import { parseStructuredQuestions } from "./parser";
import { type DraftQuestion, type Difficulty } from "./types";

const ACCEPTED = ".txt,.md,.csv,text/plain";
const MAX_BYTES = 1024 * 1024;

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

export function UploadTab({ disabled, onSave, saving }: Props) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 1 MB. Trim it down or paste the content directly.");
      return;
    }
    const isText = file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name);
    if (!isText) {
      toast.error(
        "Only plain-text files (.txt, .md, .csv) are supported in the browser. Convert PDFs/DOCX to text first.",
      );
      return;
    }
    const content = await file.text();
    setText(content);
    setFilename(file.name);
    toast.success(`Loaded ${file.name}`);
  };

  const parse = () => {
    const out = parseStructuredQuestions(text, difficulty);
    if (out.length === 0) {
      toast.error("Couldn't find any complete MCQs in the file. Check the format example below.");
      return;
    }
    setDrafts(out);
    toast.success(`${out.length} question${out.length === 1 ? "" : "s"} parsed`);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
        Upload a plain-text file ( <span className="font-mono text-foreground">.txt</span>,{" "}
        <span className="font-mono text-foreground">.md</span>,
        <span className="font-mono text-foreground"> .csv</span>) containing MCQs in this format:
        <pre className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-foreground/80 leading-relaxed overflow-x-auto">{`Q: Who wrote Hamlet?
A) Dickens
B) Shakespeare *
C) Twain
D) Hemingway

Q: ...`}</pre>
        Each question becomes an editable draft you can review before saving.
      </div>

      <div
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-8 text-center transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        role="button"
      >
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium">
          {filename ? `Loaded: ${filename}` : "Click to choose a text file"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {filename ? "Click to replace, or edit the content below." : "Up to 1 MB"}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          File contents
        </Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Paste or upload the formatted MCQ text here…"}
          className="min-h-[220px] font-mono text-xs"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div />
        <div>
          <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Default difficulty
          </Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" /> File
          </Button>
          <Button
            type="button"
            onClick={parse}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            Parse to drafts
          </Button>
        </div>
      </div>

      <DraftReview
        drafts={drafts}
        setDrafts={setDrafts}
        source="import"
        saving={saving || !!disabled}
        onSave={async (d) => {
          await onSave(d);
          setDrafts([]);
          setText("");
          setFilename("");
        }}
        onClear={() => setDrafts([])}
      />
    </div>
  );
}
