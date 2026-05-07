import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = [
  { value: "bug",         label: "🐛 Bug report" },
  { value: "feature",     label: "💡 Feature request" },
  { value: "improvement", label: "✨ Improvement idea" },
  { value: "other",       label: "💬 Other" },
];
const PRIORITIES = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
];

export function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("improvement");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setTitle(""); setBody(""); setType("improvement"); setPriority("medium"); };

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !body.trim()) { toast.error("Title and description are required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("app_feedback").insert({
      user_id: user.id, type, priority, title: title.trim(), body: body.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Feedback sent to admin — thank you!");
    reset();
    setOpen(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send feedback to admin"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-glow hover:scale-105 transition-transform"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </button>

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-elegant p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base">Send Feedback</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Help us improve Evalutease.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-1.5 hover:bg-muted/40 transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Title</Label>
              <Input placeholder="Brief summary…" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" maxLength={120} />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Description</Label>
              <Textarea
                placeholder="Describe the issue, idea, or improvement in detail…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="resize-none text-sm"
                maxLength={2000}
              />
              <div className="text-[10px] text-muted-foreground text-right mt-1">{body.length}/2000</div>
            </div>

            <Button
              onClick={() => void submit()}
              disabled={submitting || !title.trim() || !body.trim()}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Sending…" : "Send to Admin"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
