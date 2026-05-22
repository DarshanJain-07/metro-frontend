import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useFormContext } from "react-hook-form";
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

interface DocketHeaderProps {
  metadata: DocketMetadata;
}

export function DocketHeader({ metadata }: DocketHeaderProps) {
  const { register, setValue, watch } = useFormContext<DocketFormValues>();
  const branchOptions = metadata.branches.map((branch) => ({
    label: branch.name,
    value: String(branch.id),
  }));
  const cityOptions = metadata.cities.map((city) => ({
    label: `${city.name}${city.state_code ? `, ${city.state_code}` : ""}`,
    value: String(city.id),
  }));
  
  const destinationBranch = watch("destination_branch") || "";
  const toCity = watch("to_city") || "";

  const syncDestinationCity = (branchId: string) => {
    const branch = metadata.branches.find((item) => String(item.id) === branchId);
    if (branch?.city) {
      setValue("to_city", String(branch.city), { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 shrink-0">
      <div>
        <FormLabel>Docket no</FormLabel>
        <StyledInput {...register("docket_no")} readOnly placeholder="Auto" />
      </div>
      <div>
        <FormLabel>Date</FormLabel>
        <StyledInput type="date" {...register("date")} />
      </div>
      <div>
        <FormLabel>To Branch</FormLabel>
        <Combobox
          value={destinationBranch}
          onValueChange={(val) => {
            setValue("destination_branch", val || "", { shouldValidate: true });
            if (val) syncDestinationCity(val);
          }}
        >
          <ComboboxInput placeholder="Branch" className="h-8" />
          <ComboboxContent>
            <ComboboxList>
              {branchOptions.map((opt) => (
                <ComboboxItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      <div>
        <FormLabel>To City</FormLabel>
        <Combobox
          value={toCity}
          onValueChange={(val) => setValue("to_city", val || "", { shouldValidate: true })}
        >
          <ComboboxInput placeholder="City" className="h-8" />
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
      </div>
      <div>
        <FormLabel>Basis</FormLabel>
        <CustomSelect name="basis" options={[{ label: "Weight", value: "WEIGHT" }, { label: "Fixed", value: "FIXED" }, { label: "Unit", value: "UNIT" }]} />
      </div>
      <div>
        <FormLabel>Payment Type</FormLabel>
        <CustomSelect name="payment_type" options={[{ label: "Paid", value: "PAID" }, { label: "To Pay", value: "TO_PAY" }, { label: "TBB", value: "TBB" }]} />
      </div>
      <div>
        <FormLabel>Mode</FormLabel>
        <CustomSelect name="mode" options={[{ label: "Road", value: "ROAD" }, { label: "Air", value: "AIR" }, { label: "Train", value: "TRAIN" }, { label: "Sea", value: "SEA" }]} />
      </div>
      <div>
        <FormLabel>Delivery Type</FormLabel>
        <CustomSelect name="delivery_type" options={[{ label: "Door Delivery", value: "DOOR" }, { label: "Office Collection", value: "OFFICE" }]} />
      </div>
    </motion.div>
  );
}
