"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormGroup } from "@/components/ui/form-elements";
import { PageHeader } from "@/components/page-header";
import { Surface } from "@/components/ui/surface";

const REQUEST_ACCESS_EMAIL = "metroexpress456@gmail.com";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = `Metro signup request${company ? ` - ${company}` : ""}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Phone: ${phone}`,
      "",
      "Message:",
      message,
    ].join("\n");

    return `mailto:${REQUEST_ACCESS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [company, email, message, name, phone]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    window.location.href = mailtoHref;
    toast.success("Signup request prepared in your email app.");
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] animate-slide-up">
        <PageHeader title="Sign Up" className="mb-6" />
        <Surface variant="elevated" padding="lg">
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
                autoComplete="organization"
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
              Request access
            </Button>
          </form>

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
