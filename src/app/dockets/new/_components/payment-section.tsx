import { useFormContext } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FormLabel, StyledInput } from "./form-fields";
import { DocketFormValues } from "../_lib/schema";
import { calculateLineItemCharge } from "../_lib/charges";

interface PaymentSectionProps {
  isSubmitting: boolean;
}

export function PaymentSection({ isSubmitting }: PaymentSectionProps) {
  const router = useRouter();
  const { register, watch } = useFormContext<DocketFormValues>();
  
  const lineItems = watch("line_items") || [];
  const additionalCharges = watch("additional_charges");
  const deliveryCharge = watch("delivery_charge");
  const advanceAmount = watch("advance_amount");

  const calculateTotals = () => {
    const freight = lineItems.reduce((sum, item) => sum + (calculateLineItemCharge(item) || 0), 0);
    const additional = Number(additionalCharges) || 0;
    const delivery = Number(deliveryCharge) || 0;
    const advance = Number(advanceAmount) || 0;
    const finalFreight = freight + additional + delivery;
    return { freight, finalFreight, balance: finalFreight - advance };
  };

  const { freight, balance } = calculateTotals();

  return (
    <div className="lg:col-span-3 flex flex-col gap-3">
      <div className="bg-muted/20 rounded-[var(--radius)] p-3 space-y-3">
        <h3 className="section-header">Payment Details</h3>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Package Total</span>
            <span className="text-xs font-bold text-foreground">{freight}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Additional</span>
            <StyledInput className="text-right w-32" {...register("additional_charges")} />
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Delivery</span>
            <StyledInput className="text-right w-32" {...register("delivery_charge")} />
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Advance</span>
            <StyledInput className="text-right w-32" {...register("advance_amount")} />
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Balance</span>
            <span className="text-sm font-black text-foreground">{balance}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <FormLabel>Notes</FormLabel>
        <textarea 
          {...register("notes")} 
          placeholder="Enter additional notes here..."
          className="w-full h-14 px-2 py-1.5 text-xs rounded-[var(--radius)] border border-border bg-background text-foreground focus:border-ring focus:ring-0 outline-none transition-all duration-300 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button type="button" variant="outline" onClick={() => router.back()} className="h-8 w-full text-xs font-bold active-press hover-lift">Cancel</Button>
        <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 w-full text-xs font-bold active-press hover-lift">
          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
          {isSubmitting ? "Saving..." : "Save Docket"}
        </Button>
      </div>
    </div>
  );
}
