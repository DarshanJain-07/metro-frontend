"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center p-4">
      <Surface padding="lg" className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-red-50 dark:bg-red-950/30 text-red-600 rounded-md">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-sm font-semibold">Something went wrong</h1>
        <div className="mt-4 text-muted-foreground">
          <p className="text-sm">
            We encountered an unexpected error while preparing the docket form.
          </p>
          {error.digest && (
            <p className="mt-2 text-sm font-mono text-muted-foreground/60">
              Error Digest: {error.digest}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            Refresh Page
          </Button>
          <Button
            onClick={() => reset()}
            className="flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </Surface>
    </div>
  );
}
