"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormGroup } from "@/components/ui/form-elements";
import { PageHeader } from "@/components/page-header";
import { Surface } from "@/components/ui/surface";
import { readApiError } from "@/lib/api";

const PASSWORD_REQUIREMENT_MESSAGE =
  "Password must be at least 10 characters and include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.";

function getPasswordError(value: string) {
  if (
    value.length < 10 ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/\d/.test(value) ||
    !/[^A-Za-z0-9\s]/.test(value)
  ) {
    return PASSWORD_REQUIREMENT_MESSAGE;
  }
  return null;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

type SignupPendingState = {
  type?: string;
  detail?: string;
  email?: string;
  company_name?: string;
  signup_request_id?: string;
};

export default function SignupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingSignup, setPendingSignup] = useState<SignupPendingState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error("Phone number must be exactly 10 digits.");
      return;
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!organizationId.trim()) {
      toast.error("Organization ID is required.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/backend/api/v1/auth/signup-requests/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: name,
        username,
        email,
        organization_id: organizationId.trim().toUpperCase(),
        phone: normalizedPhone,
        password,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(await readApiError(response, "Could not create account."));
      return;
    }

    const payload = await response.json().catch(() => null) as SignupPendingState | null;

    if (payload?.type === "signup_email_verification_required") {
      setPendingSignup(payload);
      setVerificationCode("");
      toast.success("Verification code sent.");
      return;
    }

    setIsSubmitted(true);
    toast.success("Account created. Approval is pending.");
  };

  const handleVerifyEmail: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!pendingSignup?.signup_request_id) return;

    setIsSubmitting(true);
    const response = await fetch(
      `/api/backend/api/v1/auth/signup-requests/${pendingSignup.signup_request_id}/verify-email/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      },
    );
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(await readApiError(response, "Could not verify email."));
      return;
    }

    setIsSubmitted(true);
    setPendingSignup(null);
    toast.success("Email verified. Approval is pending.");
  };

  return (
    <div className="min-h-full bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[460px] animate-slide-up">
        <PageHeader title="Sign Up" className="mb-6" />
        <Surface variant="elevated" padding="lg">
          {isSubmitted ? (
            <div className="grid gap-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Approval pending</h2>
                <p className="text-sm text-muted-foreground">
                  Your account has been saved. The owner has been notified and will approve your role and permissions.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/sign-in">Go to sign in</Link>
              </Button>
            </div>
          ) : pendingSignup ? (
            <form onSubmit={handleVerifyEmail} className="grid gap-5">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Verify email</h2>
                <p className="text-sm text-muted-foreground">
                  {pendingSignup.detail || "Enter the verification code sent to your email address."}
                </p>
              </div>

              <FormGroup label="Verification code">
                <Input
                  id="signup-verification-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  required
                />
              </FormGroup>

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify email
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-5">
              <FormGroup label="Full name">
                <Input
                  id="signup-name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Work email">
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Username">
                <Input
                  id="signup-username"
                  autoComplete="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Organization ID">
                <Input
                  id="signup-organization-id"
                  autoComplete="off"
                  className="focus-visible:ring-1 focus-visible:ring-ring/25"
                  placeholder="Company provided ID"
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value.toUpperCase())}
                  required
                />
              </FormGroup>

              <FormGroup label="Phone">
                <Input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="Contact number"
                  value={phone}
                  onChange={(event) => setPhone(normalizePhone(event.target.value))}
                  required
                />
              </FormGroup>

              <FormGroup label="Password">
                <PasswordInput
                  id="signup-password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={10}
                  required
                />
              </FormGroup>

              <FormGroup label="Confirm password">
                <PasswordInput
                  id="signup-confirm-password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </FormGroup>

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          )}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already registered?{" "}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/sign-in">
              Sign in
            </Link>
          </p>
        </Surface>
      </div>
    </div>
  );
}
