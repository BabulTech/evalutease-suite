import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_MESSAGES, MESSAGE_FIELD_KEYS, type AppMessages } from "./types";

export function MessagesForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const storageKey = `app_messages_${userId}`;
  const [messages, setMessages] = useState<AppMessages>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...DEFAULT_MESSAGES, ...JSON.parse(saved) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_MESSAGES };
  });
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      toast.success(t("settings.messagesSaved"));
    } catch {
      toast.error("Failed to save messages");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMessages({ ...DEFAULT_MESSAGES });
    localStorage.removeItem(storageKey);
    toast.success(t("settings.messagesReset"));
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
      <div>
        <h3 className="font-semibold">{t("settings.messagesTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.messagesDesc")}</p>
      </div>

      <div className="space-y-4">
        {MESSAGE_FIELD_KEYS.map((f) => (
          <div key={f.key}>
            <Label className="mb-1">{t(f.labelKey)}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">{t(f.descKey)}</p>
            {f.multiline ? (
              <Textarea
                value={messages[f.key]}
                onChange={(e) => setMessages((prev) => ({ ...prev, [f.key]: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            ) : (
              <Input
                value={messages[f.key]}
                onChange={(e) => setMessages((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {saving ? t("settings.saving") : t("settings.saveMessages")}
        </Button>
        <Button variant="outline" onClick={reset}>
          {t("settings.resetDefaults")}
        </Button>
      </div>
    </div>
  );
}
