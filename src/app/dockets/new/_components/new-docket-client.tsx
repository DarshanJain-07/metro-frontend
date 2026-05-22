"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { docketSchema, type DocketFormValues } from "../_lib/schema";
import { createDocket } from "../_lib/actions";
import { DocketHeader } from "./docket-header";
import { PartyInfo } from "./party-info";
import { LineItemsSection } from "./line-items-section";
import { PaymentSection } from "./payment-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface DocketMetadata {
  branches: Array<{
    id: number;
    name: string;
    city: number | null;
    city_name: string | null;
  }>;
  cities: Array<{
    id: number;
    name: string;
    state_code: string | null;
  }>;
  user_branch: number | null;
}

export function NewDocketClient() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metadata, setMetadata] = useState<DocketMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const methods = useForm<DocketFormValues>({
    resolver: zodResolver(docketSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      status: "DRAFT",
      docket_no: "",
      to_city: "",
      destination_branch: "",
      consignor_city: "",
      consignee_city: "",
      basis: "WEIGHT",
      payment_type: "PAID",
      mode: "ROAD",
      delivery_type: "DOOR",
      consignor_name: "",
      consignee_name: "",
      additional_charges: "0.00",
      delivery_charge: "0.00",
      advance_amount: "0.00",
      idempotency_key: "",
      line_items: [
        {
          item_type: "GENERAL",
          package_type: "BOX",
          rate_type: "PER_PIECE",
          pieces: 2,
          actual_weight: "43",
          charged_weight: "9",
          rate: "15",
          charge: "30",
        },
      ],
    },
  });

  const { handleSubmit, setValue } = methods;
  const lineItems = useWatch({
    control: methods.control,
    name: "line_items",
  });

  useEffect(() => {
    const loadMetadata = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("Please log in to create a docket.");
        router.push("/");
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/v1/dockets/metadata/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
          toast.error("Authentication session expired.");
          router.push("/");
          return;
        }

        if (!response.ok) {
          throw new Error("Metadata request failed");
        }

        const result = (await response.json()) as DocketMetadata;
        setMetadata(result);

        const userBranch =
          result.branches.find((branch) => branch.id === result.user_branch) ||
          result.branches[0];
        const destinationBranch =
          result.branches.find((branch) => branch.id !== userBranch?.id) ||
          result.branches[0];

        if (userBranch?.city) {
          setValue("consignor_city", String(userBranch.city), { shouldValidate: true });
        }

        if (destinationBranch) {
          setValue("destination_branch", String(destinationBranch.id), { shouldValidate: true });
          if (destinationBranch.city) {
            setValue("to_city", String(destinationBranch.city), { shouldValidate: true });
            setValue("consignee_city", String(destinationBranch.city), { shouldValidate: true });
          }
        }
      } catch (error) {
        console.error("Metadata error:", error);
        toast.error("Could not load branches and cities.");
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, [router, setValue]);

  useEffect(() => {
    const generateUUID = () => {
      try {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
          return window.crypto.randomUUID();
        }
      } catch {}
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };
    setValue("idempotency_key", generateUUID());
  }, [setValue]);

  // Update charges when pieces/rate/weight change
  useEffect(() => {
    const watchedLineItems = lineItems || [];
    watchedLineItems.forEach((item, index) => {
      const rate = parseFloat(item.rate) || 0;
      const pieces = Number(item.pieces) || 0;
      const weight = parseFloat(item.charged_weight) || 0;
      
      let newCharge = "0";
      if (item.rate_type === "PER_PIECE") {
        newCharge = (rate * pieces).toFixed(0);
      } else if (item.rate_type === "PER_KG") {
        newCharge = (rate * weight).toFixed(0);
      } else if (item.rate_type === "FLAT") {
        newCharge = rate.toFixed(0);
      }

      if (item.charge !== newCharge) {
        setValue(`line_items.${index}.charge`, newCharge);
      }
    });
  }, [lineItems, setValue]);

  const onSubmit = async (data: DocketFormValues) => {
    setIsSubmitting(true);
    setFormError(null);
    setIsSuccess(false);

    const token = localStorage.getItem("access_token");
    if (!token) {
      setFormError("Authentication session expired. Please log in again.");
      toast.error("Authentication session expired.");
      router.push("/");
      return;
    }

    const result = await createDocket(data, token);

    if (result.success) {
      setIsSuccess(true);
      toast.success("Docket created successfully!");
      setTimeout(() => {
        router.push("/dockets/new");
        router.refresh();
      }, 2000);
    } else {
      setFormError(result.error);
      toast.error(result.error);
      setIsSubmitting(false);
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <FormProvider {...methods}>
      <div className="w-full h-full flex flex-col bg-card text-card-foreground">
        <div className="bg-card text-card-foreground flex-1 flex flex-col lg:overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)} className="px-4 md:px-6 pt-4 pb-0 flex-1 flex flex-col gap-6 lg:overflow-hidden">
            {isLoadingMetadata || !metadata ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Loading docket setup...
              </div>
            ) : (
              <>
                {formError && (
                  <Alert variant="destructive" className="mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Saving Docket</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                {isSuccess && (
                  <Alert className="mb-2 border-emerald-500 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 !text-emerald-600 dark:!text-emerald-400" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>Docket has been created successfully. Redirecting...</AlertDescription>
                  </Alert>
                )}
                 {!isLoadingMetadata && metadata ? (
                  <>
                    <DocketHeader metadata={metadata} />
                    <PartyInfo metadata={metadata} />
                    <motion.div variants={itemVariants} className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-10 gap-6 lg:overflow-hidden border-t border-border pt-4">
                      <LineItemsSection />
                      <PaymentSection isSubmitting={isSubmitting} />
                    </motion.div>
                  </>
                  ) : null}
              </>
            )}
          </form>
        </div>
      </div>
    </FormProvider>
  );
}
