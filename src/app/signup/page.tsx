"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { FormGroup } from "@/components/ui/form-elements";
import { PageHeader } from "@/components/page-header";
import { Surface } from "@/components/ui/surface";
import { readApiError } from "@/lib/api";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/backend/api/v1/auth/signup-requests/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: name,
        email,
        company_name: company,
        phone,
        message,
        password,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(await readApiError(response, "Could not create account."));
      return;
    }

    setIsSubmitted(true);
    toast.success("Account created. Approval is pending.");
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

              <FormGroup label="Company">
                <Input
                  id="signup-company"
                  autoComplete="off"
                  className="focus-visible:ring-1 focus-visible:ring-ring/25"
                  placeholder="Company name"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Phone">
                <Input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Contact number"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </FormGroup>

              <FormGroup label="Password">
                <PasswordInput
                  id="signup-password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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

              <FormGroup label="Message">
                <Textarea
                  id="signup-message"
                  placeholder="Tell us what access you need"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
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
