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
} from "@/components/ui/combobox";
import { DocketFormValues } from "../_lib/schema";
import type { DocketMetadata } from "./new-docket-client";

type ComboboxOption = {
  label: string;
  value: string;
};

const itemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
};

interface DocketHeaderProps {
  metadata: DocketMetadata;
}

export function DocketHeader({ metadata }: DocketHeaderProps) {
  const { register, setValue, watch } = useFormContext<DocketFormValues>();
  const branches = metadata.branches ?? [];
  const cities = metadata.cities ?? [];
  const destinationBranch = watch("destination_branch") || "";
  const toCity = watch("to_city") || "";
  const filteredBranches = toCity
    ? branches.filter((branch) => String(branch.city) === toCity)
    : [];
  const branchOptions: ComboboxOption[] = filteredBranches.map((branch) => ({
    label: branch.name,
    value: String(branch.id),
  }));
  const cityOptions: ComboboxOption[] = cities.map((city) => ({
    label: `${city.name}${city.state_code ? `, ${city.state_code}` : ""}`,
    value: String(city.id),
  }));
  const selectedDestinationBranch = branchOptions.find((opt) => opt.value === destinationBranch) || null;
  const selectedToCity = cityOptions.find((opt) => opt.value === toCity) || null;

  const handleToCityChange = (cityId: string) => {
    setValue("to_city", cityId, { shouldValidate: true, shouldDirty: true });

    const selectedBranch = branches.find((branch) => String(branch.id) === destinationBranch);
    if (!cityId || (selectedBranch && String(selectedBranch.city) !== cityId)) {
      setValue("destination_branch", "", { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
      <div>
        <FormLabel>Date</FormLabel>
        <StyledInput type="date" {...register("date")} />
      </div>
      <div>
        <FormLabel>To City</FormLabel>
        <Combobox<ComboboxOption>
          items={cityOptions}
          value={selectedToCity}
          itemToStringLabel={(item) => item.label}
          itemToStringValue={(item) => item.value}
          isItemEqualToValue={(item, value) => item.value === value.value}
          onValueChange={(val) => handleToCityChange(val?.value || "")}
        >
          <ComboboxInput placeholder="City" className="h-8" />
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
      </div>
      <div>
        <FormLabel>To Branch</FormLabel>
        <Combobox<ComboboxOption>
          items={branchOptions}
          value={selectedDestinationBranch}
          itemToStringLabel={(item) => item.label}
          itemToStringValue={(item) => item.value}
          isItemEqualToValue={(item, value) => item.value === value.value}
          onValueChange={(val) => {
            setValue("destination_branch", val?.value || "", { shouldValidate: true, shouldDirty: true });
          }}
        >
          <ComboboxInput placeholder={toCity ? "Branch" : "Select city first"} className="h-8" />
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
