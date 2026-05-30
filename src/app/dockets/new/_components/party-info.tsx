import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormLabel, StyledInput } from "./form-fields";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { DocketFormValues } from "../_lib/schema";
import type { DocketMetadata } from "./new-docket-client";

type ComboboxOption = {
  label: string;
  value: string;
};

type Party = DocketMetadata["parties"][number];
type PaginatedResponse<T> = {
  results?: T[];
};
type PartyFieldPrefix = "consignor" | "consignee";
type PartyDialogState = {
  fieldPrefix: PartyFieldPrefix;
  partyId: number | null;
  title: string;
  values: {
    name: string;
    city: string;
    phone: string;
    address: string;
    gst_number: string;
  };
};

const itemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
};

const listFromResponse = (data: Party[] | PaginatedResponse<Party>): Party[] => {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
};

interface PartyInfoProps {
  metadata: DocketMetadata;
  onPartySaved: (party: Party) => void;
}

export function PartyInfo({ metadata, onPartySaved }: PartyInfoProps) {
  const router = useRouter();
  const { register, setValue, watch } = useFormContext<DocketFormValues>();
  const cities = metadata.cities ?? [];
  const [parties, setParties] = useState<Party[]>(metadata.parties ?? []);
  const cityOptions: ComboboxOption[] = cities.map((city) => ({
    label: `${city.name}${city.state_code ? `, ${city.state_code}` : ""}`,
    value: String(city.id),
  }));

  const consignorName = watch("consignor_name") || "";
  const consigneeName = watch("consignee_name") || "";
  const [consignorInputValue, setConsignorInputValue] = useState(consignorName);
  const [consigneeInputValue, setConsigneeInputValue] = useState(consigneeName);
  const [selectedConsignorPartyId, setSelectedConsignorPartyId] = useState<string | null>(null);
  const [selectedConsigneePartyId, setSelectedConsigneePartyId] = useState<string | null>(null);
  const [billTo, setBillTo] = useState<PartyFieldPrefix>("consignor");
  const consignorCity = watch("consignor_city") || "";
  const consigneeCity = watch("consignee_city") || "";
  const consignorPhone = watch("consignor_phone") || "";
  const consigneePhone = watch("consignee_phone") || "";
  const consignorAddress = watch("consignor_address") || "";
  const consigneeAddress = watch("consignee_address") || "";
  const gstNumber = watch("gst_number") || "";
  const [partyDialog, setPartyDialog] = useState<PartyDialogState | null>(null);
  const [isSavingParty, setIsSavingParty] = useState(false);
  const selectedConsignorCity = cityOptions.find((opt) => opt.value === consignorCity) || null;
  const selectedConsigneeCity = cityOptions.find((opt) => opt.value === consigneeCity) || null;
  const partyOptions: ComboboxOption[] = parties.map((party) => ({
    label: `${party.name}${party.city_name ? `, ${party.city_name}` : ""}`,
    value: String(party.id),
  }));

  const mergeParties = useCallback((incoming: Party[]) => {
    setParties((current) => {
      const byId = new Map(current.map((party) => [party.id, party]));
      incoming.forEach((party) => byId.set(party.id, party));
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    toast.error("Authentication session expired.");
    router.push("/");
  }, [router]);

  useEffect(() => {
    const query = [consignorInputValue, consigneeInputValue]
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .sort((a, b) => b.length - a.length)[0];

    if (!query) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const response = await fetch(`${apiUrl}/api/v1/parties/?search=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Use-Primary-DB": "true",
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (!response.ok) return;

        mergeParties(listFromResponse((await response.json()) as Party[] | PaginatedResponse<Party>));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Party search failed:", error);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [consignorInputValue, consigneeInputValue, handleUnauthorized, mergeParties]);
  const getSelectedPartyOption = (name: string, selectedPartyId: string | null) => {
    if (selectedPartyId) {
      const selectedOption = partyOptions.find((opt) => opt.value === selectedPartyId);
      if (selectedOption) return selectedOption;
    }

    const party = parties.find((item) => item.name === name);
    return partyOptions.find((opt) => opt.value === String(party?.id)) || null;
  };
  const selectedConsignorParty = getSelectedPartyOption(consignorName, selectedConsignorPartyId);
  const selectedConsigneeParty = getSelectedPartyOption(consigneeName, selectedConsigneePartyId);

  const setPartyDetails = (partyId: string, fieldPrefix: PartyFieldPrefix) => {
    const party = parties.find((item) => String(item.id) === partyId);
    if (!party) return;
    applyPartyDetails(party, fieldPrefix);
  };

  const applyPartyDetails = (party: Party, fieldPrefix: PartyFieldPrefix) => {
    if (fieldPrefix === "consignor") {
      setConsignorInputValue(party.name);
      setSelectedConsignorPartyId(String(party.id));
    } else {
      setConsigneeInputValue(party.name);
      setSelectedConsigneePartyId(String(party.id));
    }

    setValue(`${fieldPrefix}_name`, party.name, { shouldValidate: true, shouldDirty: true });
    setValue(`${fieldPrefix}_city`, String(party.city), { shouldValidate: true, shouldDirty: true });
    setValue(`${fieldPrefix}_phone`, party.phone, { shouldValidate: true, shouldDirty: true });
    setValue(`${fieldPrefix}_address`, party.address, { shouldValidate: true, shouldDirty: true });

    if (fieldPrefix === "consignor" && party.gst_number) {
      setValue("gst_number", party.gst_number, { shouldValidate: true, shouldDirty: true });
    }

    if (fieldPrefix === billTo) {
      setValue("gst_party", party.name, { shouldValidate: true, shouldDirty: true });
      if (party.gst_number) {
        setValue("gst_number", party.gst_number, { shouldValidate: true, shouldDirty: true });
      }
    }
  };

  const getSelectedParty = (fieldPrefix: PartyFieldPrefix) => {
    const selectedOption = fieldPrefix === "consignor" ? selectedConsignorParty : selectedConsigneeParty;
    return parties.find((party) => String(party.id) === selectedOption?.value) || null;
  };

  const handleBillToChange = (fieldPrefix: PartyFieldPrefix) => {
    const selectedParty = getSelectedParty(fieldPrefix);
    const partyName = fieldPrefix === "consignor" ? consignorName : consigneeName;

    setBillTo(fieldPrefix);
    setValue("gst_party", partyName, { shouldValidate: true, shouldDirty: true });
    if (selectedParty?.gst_number) {
      setValue("gst_number", selectedParty.gst_number, { shouldValidate: true, shouldDirty: true });
    }
  };

  const openPartyDialog = (fieldPrefix: PartyFieldPrefix) => {
    const selectedParty = getSelectedParty(fieldPrefix);
    const isConsignor = fieldPrefix === "consignor";
    const name = isConsignor ? consignorName : consigneeName;
    const city = isConsignor ? consignorCity : consigneeCity;
    const phone = isConsignor ? consignorPhone : consigneePhone;
    const address = isConsignor ? consignorAddress : consigneeAddress;

    setPartyDialog({
      fieldPrefix,
      partyId: selectedParty?.id ?? null,
      title: `${selectedParty ? "Update" : "Add"} ${isConsignor ? "Consignor" : "Consignee"}`,
      values: {
        name,
        city,
        phone,
        address,
        gst_number: selectedParty?.gst_number || (isConsignor ? gstNumber : ""),
      },
    });
  };

  const updatePartyDialogValue = (field: keyof PartyDialogState["values"], value: string) => {
    setPartyDialog((current) => {
      if (!current) return current;
      return {
        ...current,
        values: {
          ...current.values,
          [field]: value,
        },
      };
    });
  };

  const readApiError = async (response: Response) => {
    try {
      const data = await response.json();
      if (typeof data.detail === "string") return data.detail;
      const firstError = Object.values(data).flat().find(Boolean);
      return typeof firstError === "string" ? firstError : "Could not save customer.";
    } catch {
      return "Could not save customer.";
    }
  };

  const saveParty = async () => {
    if (!partyDialog) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      handleUnauthorized();
      return;
    }

    setIsSavingParty(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const isUpdate = partyDialog.partyId !== null;
    const url = isUpdate
      ? `${apiUrl}/api/v1/parties/${partyDialog.partyId}/`
      : `${apiUrl}/api/v1/parties/`;

    try {
      const response = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Use-Primary-DB": "true",
        },
        body: JSON.stringify({
          name: partyDialog.values.name.trim(),
          city: Number(partyDialog.values.city),
          phone: partyDialog.values.phone.trim(),
          address: partyDialog.values.address.trim(),
          gst_number: partyDialog.values.gst_number.trim() || null,
        }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status === 403) {
        toast.error("You do not have permission to save customers.");
        return;
      }

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const savedParty = (await response.json()) as Party;
      onPartySaved(savedParty);
      mergeParties([savedParty]);
      applyPartyDetails(savedParty, partyDialog.fieldPrefix);
      setPartyDialog(null);
      toast.success(`Customer ${isUpdate ? "updated" : "added"} successfully.`);
    } catch (error) {
      console.error("Party save error:", error);
      toast.error("Could not save customer.");
    } finally {
      setIsSavingParty(false);
    }
  };

  return (
    <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-5 gap-8 shrink-0">
      <div className="lg:col-span-2 space-y-3">
        <h3 className="section-header">Consignor</h3>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input type="hidden" {...register("consignor_name")} />
            <Combobox<ComboboxOption>
              items={partyOptions}
              value={selectedConsignorParty}
              inputValue={consignorInputValue}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.value}
              isItemEqualToValue={(item, value) => item.value === value.value}
              onInputValueChange={(val, eventDetails) => {
                if (eventDetails.reason !== "input-change" && eventDetails.reason !== "input-clear") return;
                setSelectedConsignorPartyId(null);
                setConsignorInputValue(val);
                setValue("consignor_name", val, { shouldValidate: true, shouldDirty: true });
                if (billTo === "consignor") {
                  setValue("gst_party", val, { shouldValidate: true, shouldDirty: true });
                }
              }}
              onValueChange={(val) => {
                if (val) {
                  setPartyDetails(val.value, "consignor");
                  return;
                }
              }}
            >
              <ComboboxInput 
                placeholder="Consignor Name" 
                className="flex-1 h-8" 
              />
              <ComboboxContent>
                <ComboboxList>
                  {(opt: ComboboxOption) => (
                    <ComboboxItem key={opt.value} value={opt}>
                      {opt.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button type="button" variant="ghost" className="h-8 text-xs font-bold text-foreground hover:bg-muted px-2 active-press" onClick={() => openPartyDialog("consignor")}>
              + Add
            </Button>
          </div>
          <div className="flex gap-2">
            <input type="hidden" {...register("consignor_city")} />
            <Combobox<ComboboxOption>
              items={cityOptions}
              value={selectedConsignorCity}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.value}
              isItemEqualToValue={(item, value) => item.value === value.value}
              onValueChange={(val) => setValue("consignor_city", val?.value || "", { shouldValidate: true, shouldDirty: true })}
            >
              <ComboboxInput 
                placeholder="City" 
                className="flex-1 h-8"
              />
              <ComboboxContent>
                <ComboboxList>
                  {(opt: ComboboxOption) => (
                    <ComboboxItem key={opt.value} value={opt}>
                      {opt.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <StyledInput className="w-24" {...register("consignor_phone")} placeholder="Phone" />
          </div>
          <StyledInput {...register("consignor_address")} placeholder="Address" />
        </div>
      </div>
      
      <div className="lg:col-span-2 space-y-3">
        <h3 className="section-header">Consignee</h3>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input type="hidden" {...register("consignee_name")} />
            <Combobox<ComboboxOption>
              items={partyOptions}
              value={selectedConsigneeParty}
              inputValue={consigneeInputValue}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.value}
              isItemEqualToValue={(item, value) => item.value === value.value}
              onInputValueChange={(val, eventDetails) => {
                if (eventDetails.reason !== "input-change" && eventDetails.reason !== "input-clear") return;
                setSelectedConsigneePartyId(null);
                setConsigneeInputValue(val);
                setValue("consignee_name", val, { shouldValidate: true, shouldDirty: true });
                if (billTo === "consignee") {
                  setValue("gst_party", val, { shouldValidate: true, shouldDirty: true });
                }
              }}
              onValueChange={(val) => {
                if (val) {
                  setPartyDetails(val.value, "consignee");
                  return;
                }
              }}
            >
              <ComboboxInput 
                placeholder="Consignee Name" 
                className="flex-1 h-8" 
              />
              <ComboboxContent>
                <ComboboxList>
                  {(opt: ComboboxOption) => (
                    <ComboboxItem key={opt.value} value={opt}>
                      {opt.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button type="button" variant="ghost" className="h-8 text-xs font-bold text-foreground hover:bg-muted px-2 active-press" onClick={() => openPartyDialog("consignee")}>
              + Add
            </Button>
          </div>
          <div className="flex gap-2">
            <input type="hidden" {...register("consignee_city")} />
            <Combobox<ComboboxOption>
              items={cityOptions}
              value={selectedConsigneeCity}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.value}
              isItemEqualToValue={(item, value) => item.value === value.value}
              onValueChange={(val) => setValue("consignee_city", val?.value || "", { shouldValidate: true, shouldDirty: true })}
            >
              <ComboboxInput 
                placeholder="City" 
                className="flex-1 h-8"
              />
              <ComboboxContent>
                <ComboboxList>
                  {(opt: ComboboxOption) => (
                    <ComboboxItem key={opt.value} value={opt}>
                      {opt.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <StyledInput className="w-24" {...register("consignee_phone")} placeholder="Phone" />
          </div>
          <StyledInput {...register("consignee_address")} placeholder="Address" />
        </div>
      </div>

      <div className="lg:col-span-1 space-y-3">
        <h3 className="section-header">Billing & Info</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <FormLabel>GST Number</FormLabel>
            <input type="hidden" {...register("gst_party")} />
            <StyledInput {...register("gst_number")} placeholder="GST Number" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
              <input
                type="radio"
                name="bill_to_party"
                className="h-3.5 w-3.5 cursor-pointer"
                checked={billTo === "consignor"}
                onChange={() => handleBillToChange("consignor")}
              />
              Bill to consignor
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
              <input
                type="radio"
                name="bill_to_party"
                className="h-3.5 w-3.5 cursor-pointer"
                checked={billTo === "consignee"}
                onChange={() => handleBillToChange("consignee")}
              />
              Bill to consignee
            </label>
          </div>
        </div>
      </div>
      {partyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4">
          <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-lg">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{partyDialog.title}</h3>
              <p className="text-xs text-muted-foreground">
                {partyDialog.partyId ? "Update the selected customer details." : "Create a customer from the current docket details."}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <FormLabel>Name</FormLabel>
                <StyledInput value={partyDialog.values.name} onChange={(event) => updatePartyDialogValue("name", event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>City</FormLabel>
                  <select
                    className="h-8 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-xs outline-none focus:border-ring"
                    value={partyDialog.values.city}
                    onChange={(event) => updatePartyDialogValue("city", event.target.value)}
                  >
                    <option value="">Select city</option>
                    {cityOptions.map((city) => (
                      <option key={city.value} value={city.value}>
                        {city.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FormLabel>Phone</FormLabel>
                  <StyledInput value={partyDialog.values.phone} onChange={(event) => updatePartyDialogValue("phone", event.target.value)} />
                </div>
              </div>
              <div>
                <FormLabel>Address</FormLabel>
                <textarea
                  className="min-h-20 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  value={partyDialog.values.address}
                  onChange={(event) => updatePartyDialogValue("address", event.target.value)}
                />
              </div>
              <div>
                <FormLabel>GST Number</FormLabel>
                <StyledInput value={partyDialog.values.gst_number} onChange={(event) => updatePartyDialogValue("gst_number", event.target.value)} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPartyDialog(null)} disabled={isSavingParty}>
                Cancel
              </Button>
              <Button type="button" onClick={saveParty} disabled={isSavingParty}>
                {isSavingParty ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
