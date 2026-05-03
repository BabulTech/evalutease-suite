import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderTree, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CategoryDialog, type CategoryDraft } from "@/components/categories/CategoryDialog";
import { CategoryGrid, type CategoryCard } from "@/components/categories/CategoryGrid";
import type { IconKey } from "@/components/categories/icons";

export const Route = createFileRoute("/_app/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/categories" || pathname === "/categories/";
  const [cards, setCards] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [cats, subs, qs] = await Promise.all([
      supabase
        .from("question_categories")
        .select("id, name, icon, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("question_subcategories")
        .select("id, category_id")
        .eq("owner_id", user.id),
      supabase.from("questions").select("category_id").eq("owner_id", user.id),
    ]);
    setLoading(false);
    if (cats.error) {
      toast.error(cats.error.message);
      return;
    }
    const subCounts = new Map<string, number>();
    for (const s of subs.data ?? []) {
      subCounts.set(s.category_id, (subCounts.get(s.category_id) ?? 0) + 1);
    }
    const qCounts = new Map<string, number>();
    for (const q of qs.data ?? []) {
      if (q.category_id)
        qCounts.set(q.category_id, (qCounts.get(q.category_id) ?? 0) + 1);
    }
    setCards(
      (cats.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        icon: (c.icon ?? null) as IconKey | null,
        subcategoryCount: subCounts.get(c.id) ?? 0,
        questionCount: qCounts.get(c.id) ?? 0,
      })),
    );
  }, [user]);

  useEffect(() => {
    if (onIndex) void load();
  }, [load, onIndex]);

  if (!onIndex) return <Outlet />;

  const create = async (draft: CategoryDraft) => {
    if (!user) return;
    const { error } = await supabase
      .from("question_categories")
      .insert({ owner_id: user.id, name: draft.name, icon: draft.icon });
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Created "${draft.name}"`);
    await load();
  };

  const update = async (id: string, draft: CategoryDraft) => {
    const { error } = await supabase
      .from("question_categories")
      .update({ name: draft.name, icon: draft.icon })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Category updated");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("question_categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("Category deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t("nav.manageCategories") ?? "Manage Categories"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Group your questions by subject. Click a category to manage its sub-categories and
            questions.
          </p>
        </div>
        <CategoryDialog
          title="Add category"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Add category
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading categories…
        </div>
      ) : (
        <CategoryGrid
          categories={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <FolderTree className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No categories yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first category — e.g. <span className="text-foreground">History</span>,{" "}
                <span className="text-foreground">Science</span>,{" "}
                <span className="text-foreground">Sports</span>.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
