"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    case "access_approval_required":
      return "Approval pending";
    default:
      return "Continue sign-in";
  }
}

export function LoginPageClient() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<AuthPendingState | null>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const router = useRouter();
  const redirectTarget = useAuthRedirectTarget();
  const {
    challengeMfa,
    loginWithPassword,
    requestOtp,
    selectOrganization,
    user,
    verifyEmail,
    verifyMfa,
    verifyOtp,
  } = useAuth();

  const redirectAfterAuth = useCallback((target: string) => {
    router.replace(target);
    router.refresh();
  }, [router]);

  const completeAuthResult = useCallback(async (result: AuthResult, successMessage: string) => {
    if (result.user) {
      toast.success(successMessage);
      redirectAfterAuth(result.redirectUrl || redirectTarget);
      return;
    }

    if (result.pending) {
      setPendingAuth(result.pending);
      setEmailVerificationCode("");
      setMfaChallengeId(null);
      setMfaCode("");
      toast.message(pendingTitle(result.pending));
      return;
    }

    if (result.error) {
      toast.error(result.error);
    }
  }, [redirectAfterAuth, redirectTarget]);

  useEffect(() => {
    if (user) {
      redirectAfterAuth(redirectTarget);
    }
  }, [redirectAfterAuth, redirectTarget, user]);

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

  const handleEmailVerification: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!pendingAuth?.pending_authentication_token) return;

    setIsSubmitting(true);
    const result = await verifyEmail(
      pendingAuth.pending_authentication_token,
      emailVerificationCode,
    );
    await completeAuthResult(result, "Email verified.");
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
    <div className="min-h-full bg-background flex items-center justify-center p-4 sm:p-6">
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
                  <form onSubmit={handleEmailVerification} className="grid gap-5">
                    <FormGroup label="Email verification code">
                      <Input
                        id="email-verification-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter code"
                        value={emailVerificationCode}
                        onChange={(event) => setEmailVerificationCode(event.target.value)}
                        required
                      />
                    </FormGroup>
                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify email
                    </Button>
                  </form>
                )}

                {pendingAuth.type === "access_approval_required" && (
                  <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {pendingAuth.company_name || "Your organization"} will appear here after approval.
                    </p>
                    <p className="mt-2">
                      Your sign-in is complete, but an admin still needs to approve your role and permissions.
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={() => {
                    setPendingAuth(null);
                    setEmailVerificationCode("");
                    setMfaChallengeId(null);
                    setMfaCode("");
                  }}
                >
                  {pendingAuth.type === "access_approval_required" ? "Use another account" : "Back to sign-in"}
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
