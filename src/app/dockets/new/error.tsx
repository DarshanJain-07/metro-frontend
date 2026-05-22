"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="w-full max-w-md border-destructive/20 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold">Something went wrong!</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p className="text-sm">
            We encountered an unexpected error while preparing the docket form.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs font-mono text-muted-foreground/60">
              Error Digest: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center gap-4 pt-2">
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
        </CardFooter>
      </Card>
    </div>
  );
}
