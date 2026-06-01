"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useForm, FormProvider, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { docketSchema, type DocketFormValues } from "../_lib/schema";
import { createDocket, getDocket, updateDocket } from "../_lib/actions";
import { DocketHeader } from "./docket-header";
import { PartyInfo } from "./party-info";
import { LineItemsSection } from "./line-items-section";
import { PaymentSection } from "./payment-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface DocketMetadata {
  branches: Array<{
    id: string;
    name: string;
    city: string | null;
    city_name: string | null;
  }>;
  cities: Array<{
    id: string;
    name: string;
    state: string;
    state_code: string | null;
    state_name?: string | null;
  }>;
  states: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  parties: Array<{
    id: string;
    name: string;
    phone: string;
    address: string;
    city: string;
    city_name: string | null;
    state_code: string | null;
    gst_number: string | null;
  }>;
  user_branch: string | null;
}

export function NewDocketClient({ docketId }: { docketId?: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metadata, setMetadata] = useState<DocketMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isLoadingDocket, setIsLoadingDocket] = useState(!!docketId);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const methods = useForm<DocketFormValues>({
    resolver: zodResolver(docketSchema) as Resolver<DocketFormValues>,
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      status: "DRAFT",
      to_city: "",
      destination_branch: "",
      consignor_city: "",
      consignee_city: "",
      consignor_name: "",
      consignor_phone: "",
      consignor_address: "",
      consignee_name: "",
      consignee_phone: "",
      consignee_address: "",
      basis: "WEIGHT",
      payment_type: "PAID",
      mode: "ROAD",
      delivery_type: "DOOR",
      gst_party: "",
      gst_number: "",
      notes: "",
      additional_charges: 0,
      delivery_charge: 0,
      advance_amount: 0,
      idempotency_key: "",
      line_items: [
        {
          item_type: "GENERAL",
          package_type: "BOX",
          rate_type: "PER_PIECE",
          pieces: 2,
          actual_weight: 43,
          charged_weight: 9,
          rate: 15,
          charge: 30,
        },
      ],
    },
  });

  const { handleSubmit, setValue, reset } = methods;

  const handlePartySaved = (party: DocketMetadata["parties"][number]) => {
    setMetadata((current) => {
      if (!current) return current;

      const parties = current.parties.some((item) => item.id === party.id)
        ? current.parties.map((item) => (item.id === party.id ? party : item))
        : [...current.parties, party];

      return {
        ...current,
        parties: parties.sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
  };

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
        const headers = {
          Authorization: `Bearer ${token}`,
          "X-Use-Primary-DB": "true",
        };
        const response = await fetch(`${apiUrl}/api/v1/dockets/metadata/`, {
          headers,
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

        const metadataData = await response.json();
        
        // Ensure parties is an array (handle potential paginated response from metadata)
        if (metadataData.parties && !Array.isArray(metadataData.parties)) {
          metadataData.parties = metadataData.parties.results || [];
        }

        // Ensure parties are fetched from the master API if not present or empty in metadata
        if (!metadataData.parties || metadataData.parties.length === 0) {
          try {
            const partiesRes = await fetch(`${apiUrl}/api/v1/master/parties/`, { headers });
            if (partiesRes.ok) {
              const partiesData = await partiesRes.json();
              metadataData.parties = Array.isArray(partiesData) ? partiesData : (partiesData.results || []);
            }
          } catch (err) {
            console.error("Failed to fetch parties from master API", err);
          }
        }

        setMetadata(metadataData as DocketMetadata);

        if (docketId) {
          const docketResult = await getDocket(docketId, token);
          if (docketResult.success && docketResult.data) {
            const docket = docketResult.data;
            // Map API response to form values
            reset({
              ...docket,
              to_city: String(docket.to_city),
              destination_branch: String(docket.destination_branch),
              consignor_city: String(docket.consignor_city),
              consignee_city: String(docket.consignee_city),
              additional_charges: Number(docket.additional_charges),
              delivery_charge: Number(docket.delivery_charge),
              advance_amount: Number(docket.advance_amount),
              line_items: docket.line_items.map((item: any) => ({
                ...item,
                pieces: Number(item.pieces),
                actual_weight: Number(item.actual_weight),
                charged_weight: Number(item.charged_weight),
                rate: Number(item.rate),
                charge: Number(item.charge),
              })),
            });
          } else {
            toast.error(docketResult.error || "Failed to load docket data");
          }
          setIsLoadingDocket(false);
        }
      } catch (error) {
        console.error("Metadata error:", error);
        toast.error("Could not load data.");
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, [router, docketId, reset]);

  useEffect(() => {
    if (docketId) return; // Don't generate new idempotency key for updates
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

  const onSubmit = async (data: DocketFormValues) => {
    setIsSubmitting(true);
    setFormError(null);
    setIsSuccess(false);

    const token = localStorage.getItem("access_token");
    if (!token) {
      setFormError("Authentication session expired. Please log in again.");
      toast.error("Authentication session expired.");
      setIsSubmitting(false);
      router.push("/");
      return;
    }

    const result = docketId 
      ? await updateDocket(docketId, data, token)
      : await createDocket(data, token);

    if (result.success) {
      setIsSuccess(true);
      toast.success(`Docket ${result.data?.docket_no || ""} ${docketId ? "updated" : "created"} successfully!`.trim());
      setTimeout(() => {
        if (docketId) {
          router.push("/dockets");
        } else {
          router.push("/dockets/new");
        }
        router.refresh();
      }, 2000);
    } else {
      if (result.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        router.push("/");
      }
      const errorMessage = result.error || "An unknown error occurred";
      setFormError(errorMessage);
      toast.error(errorMessage);
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
            {isLoadingMetadata || isLoadingDocket || !metadata ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="form-grid-8">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-2 w-12 uber-loader animate-pulse rounded" />
                      <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                    </div>
                  ))}
                </div>
                <div className="form-grid-2">
                  <div className="space-y-4">
                    <div className="h-3 w-20 uber-loader animate-pulse rounded" />
                    <div className="space-y-2">
                      <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                      <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-3 w-20 uber-loader animate-pulse rounded" />
                    <div className="space-y-2">
                      <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                      <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="h-24 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                </div>
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
                    <AlertDescription>Docket has been {docketId ? "updated" : "created"} successfully. Redirecting...</AlertDescription>
                  </Alert>
                )}
                <DocketHeader metadata={metadata} />
                <PartyInfo metadata={metadata} onPartySaved={handlePartySaved} />
                <motion.div variants={itemVariants} className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-10 gap-6 lg:overflow-hidden border-t border-border pt-4">
                  <LineItemsSection />
                  <PaymentSection isSubmitting={isSubmitting} docketId={docketId} />
                </motion.div>
              </>
            )}
          </form>
        </div>
      </div>
    </FormProvider>
  );
}
