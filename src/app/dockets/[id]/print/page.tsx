import { Suspense } from "react";
import PrintDocketContent from "./_print-content";

export default function PrintDocketPage() {
  return (
    <Suspense fallback={null}>
      <PrintDocketContent />
    </Suspense>
  );
}
