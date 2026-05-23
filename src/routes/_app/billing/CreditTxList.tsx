import { TrendingUp, TrendingDown } from "lucide-react";
import { TX_LABELS } from "./constants";
import type { CreditTx } from "./types";

export function CreditTxList({ items }: { items: CreditTx[] }) {
  return (
    <ul className="space-y-2 mt-1">
      {items.map((tx) => {
        const isAdd = tx.amount > 0;
        return (
          <li
            key={tx.id}
            className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`rounded-lg p-1.5 shrink-0 ${isAdd ? "bg-success/15" : "bg-warning/15"}`}
              >
                {isAdd ? (
                  <TrendingUp className="size-3.5 text-success" />
                ) : (
                  <TrendingDown className="size-3.5 text-warning" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {TX_LABELS[tx.type] ?? tx.type.replace(/_/g, " ")}
                </div>
                {tx.description && (
                  <div className="text-[10px] text-muted-foreground truncate">{tx.description}</div>
                )}
                <div className="text-[10px] text-muted-foreground">
                  {new Date(tx.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            <span
              className={`text-sm font-bold shrink-0 ml-3 ${isAdd ? "text-success" : "text-warning"}`}
            >
              {isAdd ? "+" : ""}
              {tx.amount}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
