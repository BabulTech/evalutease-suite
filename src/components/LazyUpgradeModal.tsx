import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";

const UpgradeModal = lazy(() =>
  import("@/components/UpgradeModal").then((module) => ({ default: module.UpgradeModal })),
);

type Props = ComponentProps<typeof UpgradeModal>;

export function LazyUpgradeModal(props: Props) {
  return (
    <Suspense fallback={null}>
      <UpgradeModal {...props} />
    </Suspense>
  );
}
