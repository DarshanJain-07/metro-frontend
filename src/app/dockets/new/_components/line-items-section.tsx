import { useFormContext, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { StyledInput } from "./form-fields";
import { CustomSelect } from "./custom-select";
import { DocketFormValues } from "../_lib/schema";

export function LineItemsSection() {
  const { register, control, watch } = useFormContext<DocketFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const lineItems = watch("line_items");

  return (
    <div className="lg:col-span-7 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto pr-2">
        <table className="w-full text-xs min-w-[800px]">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="text-muted-foreground font-medium border-b border-border">
              <th className="text-left py-2 font-medium px-1 w-48">Item</th>
              <th className="text-left py-2 font-medium px-1 w-24">Type</th>
              <th className="text-left py-2 font-medium px-1 w-28">Rate type</th>
              <th className="text-right py-2 font-medium px-1 w-16">Pcs</th>
              <th className="text-left py-2 font-medium px-1 w-20">Actual wt</th>
              <th className="text-left py-2 font-medium px-1 w-20">Charge wt</th>
              <th className="text-left py-2 font-medium px-1 w-20">Rate</th>
              <th className="text-right py-2 font-medium px-1 w-20">Charge</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {fields.map((field, idx) => (
              <tr
                key={field.id}
              >
                <td className="py-1 px-1">
                  <CustomSelect
                    name={`line_items.${idx}.item_type`}
                    options={[
                      { label: "General", value: "GENERAL" },
                      { label: "Hazardous", value: "HAZARDOUS" },
                      { label: "Perishable", value: "PERISHABLE" },
                      { label: "Fragile", value: "FRAGILE" },
                    ]}
                  />
                </td>
                <td className="py-1 px-1">
                  <CustomSelect
                    name={`line_items.${idx}.package_type`}
                    options={[
                      { label: "Box", value: "BOX" },
                      { label: "Bag", value: "BAG" },
                      { label: "Crate", value: "CRATE" },
                      { label: "Bundle", value: "BUNDLE" },
                      { label: "Pallet", value: "PALLET" },
                    ]}
                  />
                </td>
                <td className="py-1 px-1">
                  <CustomSelect
                    name={`line_items.${idx}.rate_type`}
                    options={[
                      { label: "Per piece", value: "PER_PIECE" },
                      { label: "Per kg", value: "PER_KG" },
                      { label: "Flat rate", value: "FLAT" },
                    ]}
                  />
                </td>
                <td className="py-1 px-1">
                  <StyledInput className="text-right" type="number" {...register(`line_items.${idx}.pieces`)} />
                </td>
                <td className="py-1 px-1">
                  <StyledInput {...register(`line_items.${idx}.actual_weight`)} />
                </td>
                <td className="py-1 px-1">
                  <StyledInput {...register(`line_items.${idx}.charged_weight`)} />
                </td>
                <td className="py-1 px-1">
                  <StyledInput {...register(`line_items.${idx}.rate`)} />
                </td>
                <td className="py-1 px-1 font-bold text-right text-xs text-foreground">
                  {lineItems[idx]?.charge}
                </td>
                <td className="py-1 px-1 text-center">
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-destructive hover:text-destructive/80 active-press"
                    disabled={fields.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center py-2 shrink-0 border-t border-border/50">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={() => append({ item_type: "GENERAL", package_type: "BOX", rate_type: "PER_PIECE", pieces: 1, actual_weight: "0", charged_weight: "0", rate: "0", charge: "0" })} 
          className="h-8 text-xs font-bold uppercase tracking-widest px-4 active-press hover-lift"
        >
          + Add row
        </Button>
      </div>
    </div>
  );
}
