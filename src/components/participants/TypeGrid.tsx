/* eslint-disable sonarjs/cognitive-complexity -- grid card renders have many conditional branches by design */
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { iconFor, type IconKey } from "@/components/categories/icons";
import type { TypeDraft } from "./TypeDialog";
import { TypeRowMenu } from "./type-grid/TypeRowMenu";
import type { ReactNode } from "react";

export type TypeCard = {
  id: string;
  name: string;
  icon: IconKey | null;
  subtypeCount: number;
  participantCount: number;
};

type Props = {
  types: TypeCard[];
  onEdit: (id: string, draft: TypeDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyState?: ReactNode;
};

export function TypeGrid({ types, onEdit, onDelete, emptyState }: Props) {
  if (types.length === 0 && emptyState) return <>{emptyState}</>;

  const totalParticipants = types.reduce((s, c) => s + c.participantCount, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {types.map((c) => {
        const Icon = iconFor(c.icon);
        const sharePct =
          totalParticipants > 0 ? Math.round((c.participantCount / totalParticipants) * 100) : 0;
        return (
          <div
            key={c.id}
            className="group relative rounded-2xl border border-border bg-card/60 hover:border-primary/40 hover:shadow-glow transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-3 right-3 z-10">
              <TypeRowMenu type={c} onEdit={onEdit} onDelete={onDelete} />
            </div>

            <Link
              to="/participant-types/$typeId"
              params={{ typeId: c.id }}
              className="block p-5 pr-10"
            >
              <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow mb-4">
                <Icon className="size-6" />
              </div>

              <div className="font-display text-lg font-bold truncate">{c.name}</div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.participantCount}</span>{" "}
                  participants
                </span>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.subtypeCount}</span>{" "}
                  {c.subtypeCount === 1 ? "group" : "groups"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                  Browse <ArrowRight className="size-3.5" />
                </span>
                {totalParticipants > 0 && (
                  <span className="text-[10px] text-muted-foreground">{sharePct}% of total</span>
                )}
              </div>

              {totalParticipants > 0 && (
                <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-primary/60 transition-all ${
                      sharePct <= 10
                        ? "w-[10%]"
                        : sharePct <= 20
                          ? "w-1/5"
                          : sharePct <= 25
                            ? "w-1/4"
                            : sharePct <= 33
                              ? "w-1/3"
                              : sharePct <= 50
                                ? "w-1/2"
                                : sharePct <= 66
                                  ? "w-2/3"
                                  : sharePct <= 75
                                    ? "w-3/4"
                                    : sharePct <= 90
                                      ? "w-[90%]"
                                      : "w-full"
                    }`}
                  />
                </div>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
