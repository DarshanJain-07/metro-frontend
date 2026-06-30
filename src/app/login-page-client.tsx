"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth, type AuthPendingState, type AuthResult } from "@/lib/auth-context";
import { FormGroup } from "@/components/ui/form-elements";
import { PageHeader } from "@/components/page-header";
import { Surface } from "@/components/ui/surface";
import { useAuthRedirectTarget } from "@/lib/auth-redirect";

type LoginMode = "password" | "otp";

function pendingTitle(pending: AuthPendingState) {
  switch (pending.type) {
    case "mfa_challenge":
    case "mfa_enrollment":
      return "Additional verification required";
    case "organization_selection_required":
      return "Choose an organization";
    case "email_verification_required":
      return "Verify your email";
    default:
      return "Continue sign-in";
  }
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v2.95h3.89c2.27-2.09 3.53-5.17 3.53-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-2.95c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.76-2.11-6.71-4.94H1.28v3.04A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.35A7.2 7.2 0 0 1 4.91 12c0-.82.14-1.61.38-2.35V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.78 1.28 5.39l4.01-3.04Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.71c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.56 11.56 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.04C6.24 6.82 8.88 4.71 12 4.71Z"
      />
    </svg>
  );
}

export function LoginPageClient() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<AuthPendingState | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const exchangeHandledRef = useRef(false);
  const authErrorHandledRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = useAuthRedirectTarget();
  const {
    challengeMfa,
    exchangeGoogleCode,
    exchangeGoogleLogin,
    loginWithPassword,
    requestOtp,
    selectOrganization,
    startGoogleLogin,
    user,
    verifyMfa,
    verifyOtp,
  } = useAuth();

  const completeAuthResult = useCallback(async (result: AuthResult, successMessage: string) => {
    if (result.user) {
      toast.success(successMessage);
      router.push(result.redirectUrl || redirectTarget);
      return;
    }

    if (result.pending) {
      setPendingAuth(result.pending);
      setMfaChallengeId(null);
      setMfaCode("");
      toast.message(pendingTitle(result.pending));
      return;
    }

    if (result.error) {
      toast.error(result.error);
    }
  }, [redirectTarget, router]);

  useEffect(() => {
    if (user) {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router, user]);

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError && !authErrorHandledRef.current) {
      authErrorHandledRef.current = true;
      toast.error("Could not complete Google sign-in.");
    }
  }, [searchParams]);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const exchangeCode = searchParams.get("workos_exchange_code");
    if ((!exchangeCode && (!code || !state)) || exchangeHandledRef.current) return;

    exchangeHandledRef.current = true;
    setIsSubmitting(true);
    const exchange = exchangeCode
      ? exchangeGoogleLogin(exchangeCode)
      : exchangeGoogleCode(code as string, state as string);
    exchange
      .then((result) => completeAuthResult(result, "Signed in with Google."))
      .finally(() => setIsSubmitting(false));
  }, [completeAuthResult, exchangeGoogleCode, exchangeGoogleLogin, searchParams]);

  const handlePasswordSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await loginWithPassword(identifier, password);
      await completeAuthResult(result, "Signed in successfully.");
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleOtpStart: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await requestOtp(identifier);
      if (result.ok) {
        setOtpSent(true);
        toast.success("Sign-in code sent.");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleOtpVerify: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await verifyOtp(identifier, otpCode);
      await completeAuthResult(result, "Signed in successfully.");
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await startGoogleLogin(redirectTarget);
      if (result.error) {
        toast.error(result.error);
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleMfaChallenge = async (factorId: string) => {
    setIsSubmitting(true);
    const result = await challengeMfa(factorId);
    if (result.authenticationChallengeId) {
      setMfaChallengeId(result.authenticationChallengeId);
      toast.success("Enter your verification code.");
    } else if (result.error) {
      toast.error(result.error);
    }
    setIsSubmitting(false);
  };

  const handleMfaVerify: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!pendingAuth?.pending_authentication_token || !mfaChallengeId) return;

    setIsSubmitting(true);
    const result = await verifyMfa(
      pendingAuth.pending_authentication_token,
      mfaChallengeId,
      mfaCode,
    );
    await completeAuthResult(result, "Signed in successfully.");
    setIsSubmitting(false);
  };

  const handleOrganizationSelect = async (organizationId: string) => {
    if (!pendingAuth?.pending_authentication_token) return;

    setIsSubmitting(true);
    const result = await selectOrganization(pendingAuth.pending_authentication_token, organizationId);
    await completeAuthResult(result, "Signed in successfully.");
    setIsSubmitting(false);
  };

  const firstMfaFactor = pendingAuth?.authentication_factors?.[0];

  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[460px] animate-slide-up">
        <PageHeader title="Sign In" className="mb-6" />
        <Surface variant="elevated" padding="lg">
          <div className="grid gap-5">
            {pendingAuth ? (
              <div className="grid gap-5">
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>{pendingTitle(pendingAuth)}</AlertTitle>
                  <AlertDescription>
                    {pendingAuth.detail || "Complete the required step to continue."}
                  </AlertDescription>
                </Alert>

                {pendingAuth.type === "organization_selection_required" && (
                  <div className="grid gap-3">
                    {(pendingAuth.organizations || []).map((organization) => (
                      <Button
                        key={organization.id}
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        disabled={isSubmitting}
                        onClick={() => handleOrganizationSelect(organization.id)}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        {organization.name || organization.id}
                      </Button>
                    ))}
                  </div>
                )}

                {pendingAuth.type === "mfa_challenge" && !mfaChallengeId && (
                  <div className="grid gap-3">
                    {(pendingAuth.authentication_factors || []).map((factor) => (
                      <Button
                        key={factor.id}
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        disabled={isSubmitting}
                        onClick={() => handleMfaChallenge(factor.id)}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {factor.type === "totp" ? "Authenticator app" : factor.type || "MFA factor"}
                      </Button>
                    ))}
                    {!firstMfaFactor && (
                      <p className="text-sm text-muted-foreground">
                        No MFA factor was returned for this sign-in attempt.
                      </p>
                    )}
                  </div>
                )}

                {pendingAuth.type === "mfa_challenge" && mfaChallengeId && (
                  <form onSubmit={handleMfaVerify} className="grid gap-5">
                    <FormGroup label="Verification code">
                      <Input
                        id="mfa-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter code"
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value)}
                        required
                      />
                    </FormGroup>
                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify code
                    </Button>
                  </form>
                )}

                {pendingAuth.type === "email_verification_required" && (
                  <p className="text-sm text-muted-foreground">
                    Check your inbox for the verification email, then try signing in again.
                  </p>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => {
                    setPendingAuth(null);
                    setMfaChallengeId(null);
                    setMfaCode("");
                  }}
                >
                  Back to sign-in
                </Button>
              </div>
            ) : (
              <>
                {mode === "password" ? (
                  <div className="grid gap-4">
                    <form onSubmit={handlePasswordSubmit} className="grid gap-5">
                      <FormGroup label="Email or username">
                        <Input
                          id="identifier"
                          type="text"
                          autoComplete="username"
                          placeholder="name@company.com or username"
                          value={identifier}
                          onChange={(event) => setIdentifier(event.target.value)}
                          required
                        />
                      </FormGroup>

                      <FormGroup label="Password">
                        <PasswordInput
                          id="password"
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                        />
                      </FormGroup>

                      <Button className="w-full" type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? "Signing in..." : "Sign in"}
                      </Button>
                    </form>

                    <div className="text-center text-xs text-muted-foreground">
                      <p>
                        Want to use a code instead?{" "}
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => {
                            setMode("otp");
                            setOtpSent(false);
                            setOtpCode("");
                          }}
                        >
                          Sign in with OTP
                        </button>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <form onSubmit={otpSent ? handleOtpVerify : handleOtpStart} className="grid gap-5">
                      <FormGroup label="Email or username">
                        <Input
                          id="otp-identifier"
                          type="text"
                          autoComplete="username"
                          placeholder="name@company.com or username"
                          value={identifier}
                          onChange={(event) => setIdentifier(event.target.value)}
                          required
                        />
                      </FormGroup>

                      {otpSent && (
                        <FormGroup label="Sign-in code">
                          <Input
                            id="otp-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="Enter code"
                            value={otpCode}
                            onChange={(event) => setOtpCode(event.target.value)}
                            required
                          />
                        </FormGroup>
                      )}

                      <Button className="w-full" type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {otpSent ? "Verify code" : "Send sign-in code"}
                      </Button>
                    </form>

                    <div className="text-center text-xs text-muted-foreground">
                      <p>
                        Prefer using your password?{" "}
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => setMode("password")}
                        >
                          Sign in with password
                        </button>
                      </p>
                    </div>
                  </div>
                )}

                <div className="relative flex items-center">
                  <div className="h-px flex-1 bg-border" />
                  <span className="px-3 text-xs uppercase tracking-wider text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={handleGoogle}
                >
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Continue with Google
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Haven&apos;t registered yet?{" "}
                  <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/signup">
                    Sign up
                  </Link>
                </p>
              </>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}
