import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormLabel, StyledInput } from "./form-fields";
import { CustomSelect } from "./custom-select";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { DocketFormValues } from "../_lib/schema";
import type { DocketMetadata } from "./new-docket-client";

const itemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
};

interface PartyInfoProps {
  metadata: DocketMetadata;
}

export function PartyInfo({ metadata }: PartyInfoProps) {
  const { register, setValue, watch } = useFormContext<DocketFormValues>();
  const cityOptions = metadata.cities.map((city) => ({
    label: `${city.name}${city.state_code ? `, ${city.state_code}` : ""}`,
    value: String(city.id),
  }));

  const consignorName = watch("consignor_name") || "";
  const consigneeName = watch("consignee_name") || "";
  const consignorCity = watch("consignor_city") || "";
  const consigneeCity = watch("consignee_city") || "";

  return (
    <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-5 gap-8 shrink-0">
      <div className="lg:col-span-2 space-y-3">
        <h3 className="section-header">Consignor</h3>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Combobox
              value={consignorName}
              onValueChange={(val) => setValue("consignor_name", val || "")}
            >
              <ComboboxInput 
                placeholder="Consignor Name" 
                className="flex-1 h-8" 
                {...register("consignor_name")}
              />
              <ComboboxContent>
                <ComboboxList>
                  {/* Placeholder for party list */}
                  <ComboboxItem value="Walk-in Customer">Walk-in Customer</ComboboxItem>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button type="button" variant="ghost" className="h-8 text-xs font-bold text-foreground hover:bg-muted px-2 active-press">
              + Add
            </Button>
          </div>
          <div className="flex gap-2">
            <Combobox
              value={consignorCity}
              onValueChange={(val) => setValue("consignor_city", val || "", { shouldValidate: true })}
            >
              <ComboboxInput 
                placeholder="City" 
                className="flex-1 h-8"
              />
              <ComboboxContent>
                <ComboboxList>
                  {cityOptions.map((opt) => (
                    <ComboboxItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ComboboxItem>
                  ))}
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
            <Combobox
              value={consigneeName}
              onValueChange={(val) => setValue("consignee_name", val || "")}
            >
              <ComboboxInput 
                placeholder="Consignee Name" 
                className="flex-1 h-8" 
                {...register("consignee_name")}
              />
              <ComboboxContent>
                <ComboboxList>
                  {/* Placeholder for party list */}
                  <ComboboxItem value="Walk-in Customer">Walk-in Customer</ComboboxItem>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button type="button" variant="ghost" className="h-8 text-xs font-bold text-foreground hover:bg-muted px-2 active-press">
              + Add
            </Button>
          </div>
          <div className="flex gap-2">
            <Combobox
              value={consigneeCity}
              onValueChange={(val) => setValue("consignee_city", val || "", { shouldValidate: true })}
            >
              <ComboboxInput 
                placeholder="City" 
                className="flex-1 h-8"
              />
              <ComboboxContent>
                <ComboboxList>
                  {cityOptions.map((opt) => (
                    <ComboboxItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ComboboxItem>
                  ))}
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
            <StyledInput {...register("gst_number")} placeholder="GST Number" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="bill_consignor" className="rounded-[var(--radius)] border-border text-primary h-3.5 w-3.5 cursor-pointer active-press" defaultChecked />
            <label htmlFor="bill_consignor" className="text-xs font-medium text-muted-foreground cursor-pointer">Bill to consignor</label>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
