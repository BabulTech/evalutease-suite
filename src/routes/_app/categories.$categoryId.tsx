import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, FolderOpen, HelpCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SubCategoryDialog } from "@/components/categories/SubCategoryDialog";
import { SubCategoryGrid } from "@/components/categories/SubCategoryGrid";
import { iconFor, type IconKey } from "@/components/categories/icons";
import { useCategoryDetail } from "./categories.$categoryId/useCategoryDetail";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/categories/$categoryId")({
  component: CategoryDetailPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function CategoryDetailPage() {
  const { categoryId } = Route.useParams();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const expected = `/categories/${categoryId}`;
  const onIndex = pathname === expected || pathname === expected + "/";

  const { category, cards, loading, create, update, remove } = useCategoryDetail(
    user,
    categoryId,
    onIndex,
  );

  if (!onIndex) return <Outlet />;

  const Icon = iconFor((category?.icon ?? null) as IconKey | null);
  const totalQuestions = cards.reduce((s, c) => s + c.questionCount, 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          to="/categories"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <BookOpen size={12} /> All categories
        </Link>
        <ChevronLeft className="size-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium">{category?.name ?? "Category"}</span>
      </nav>

      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <Icon className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {category?.name ?? "Category"}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FolderOpen size={11} /> {cards.length} {cards.length === 1 ? "topic" : "topics"}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <HelpCircle size={11} /> {totalQuestions}{" "}
                {totalQuestions === 1 ? "question" : "questions"}
              </span>
            </div>
          </div>
        </div>
        <SubCategoryDialog
          title="Add topic"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="h-10 gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="size-4" /> Add Topic
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          Loading topics…
        </div>
      ) : (
        <SubCategoryGrid
          subcategories={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
              <FolderOpen className="mx-auto size-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-semibold">No topics yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a topic to organise questions, e.g.{" "}
                  <span className="text-foreground">World War II</span>,{" "}
                  <span className="text-foreground">Class 9</span>, or{" "}
                  <span className="text-foreground">Lecture 1</span>.
                </p>
              </div>
              <SubCategoryDialog
                title="Add topic"
                submitLabel="Create"
                onSubmit={create}
                trigger={
                  <Button
                    size="sm"
                    className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
                  >
                    <Plus size={14} /> Add first topic
                  </Button>
                }
              />
            </div>
          }
        />
      )}
    </div>
  );
}
