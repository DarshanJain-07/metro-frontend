import { Suspense } from "react";
import { LoginPageClient } from "./login-page-client";

function LoginFallback() {
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
