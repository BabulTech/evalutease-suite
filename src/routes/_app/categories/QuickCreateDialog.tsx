import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "category" | "subcategory";
  categoryId?: string;
  onCreated: (id: string, name: string) => void;
};

export function QuickCreateDialog({ open, onClose, mode, categoryId, onCreated }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    if (mode === "category") {
      const { data, error } = await supabase
        .from("question_categories")
        .insert({ owner_id: user.id, name: name.trim() })
        .select("id")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("cat.categoryCreated").replace("{name}", name.trim()));
      onCreated(data.id, name.trim());
    } else {
      if (!categoryId) return;
      const { data, error } = await supabase
        .from("question_subcategories")
        .insert({
          owner_id: user.id,
          category_id: categoryId,
          name: name.trim(),
          description: desc.trim() || null,
        })
        .select("id")
        .single();
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("cat.topicCreated").replace("{name}", name.trim()));
      onCreated(data.id, name.trim());
    }
    setName("");
    setDesc("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elegant space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-base">
            {mode === "category" ? t("cat.newCategory") : t("cat.newTopic")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted/40 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              {mode === "category" ? t("cat.categoryName") : t("cat.topicName")} *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("cat.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              className="h-11"
            />
          </div>
          {mode === "subcategory" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                {t("cat.descOptional")}
              </label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder={t("cat.descPlaceholder")}
                className="h-11"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-11 cursor-pointer" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1 h-11 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
          >
            {saving ? t("cat.creating") : t("common.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
