import { lazy, Suspense } from "react";
import { useSnapshot } from "valtio";

import { settingStore } from "@/stores/settingStore";

import { DioramaBoundary } from "./DioramaBoundary";

const LazyMount = lazy(() =>
  import("./DioramaMount").then(({ DioramaMount }) => ({
    default: DioramaMount,
  })),
);

export const DioramaLayer = () => {
  const { enabled } = useSnapshot(settingStore.diorama);
  if (!enabled) return null;
  return (
    <DioramaBoundary>
      <Suspense fallback={null}>
        <LazyMount />
      </Suspense>
    </DioramaBoundary>
  );
};
