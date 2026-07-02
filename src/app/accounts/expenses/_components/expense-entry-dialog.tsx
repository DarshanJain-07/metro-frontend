"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray, FormProvider, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  CompactInput, 
  CompactSelect, 
  FormGroup 
} from "@/components/ui/form-elements";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Calendar, Building2 } from "lucide-react";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { masterKeys } from "@/lib/query-keys";

const expenseRowSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  notes: z.string().optional(),
});

const expenseEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  office: z.string().min(1, "Office is required"),
  expenses: z.array(expenseRowSchema).min(1, "At least one expense is required"),
});

type ExpenseEntryValues = z.infer<typeof expenseEntrySchema>;

interface ExpenseEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type OfficeOptionApi = {
  id: string | number;
  name: string;
};

export function ExpenseEntryDialog({ isOpen, onOpenChange, onSuccess }: ExpenseEntryDialogProps) {
  const { activeMembership } = useAuth();

  const methods = useForm<ExpenseEntryValues>({
    resolver: zodResolver(expenseEntrySchema) as Resolver<ExpenseEntryValues>,
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      office: "",
      expenses: [{ category: "", amount: 0, notes: "" }],
    },
  });

  const { register, control, handleSubmit, formState: { errors }, reset } = methods;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "expenses",
  });
  const selectedOffice = useWatch({ control, name: "office" });

  const { data: officeOptions = [] } = useQuery({
    queryKey: masterKeys.options(activeMembership?.id, "expense-offices"),
    queryFn: async () => {
      const res = await fetchWithAuth("/api/v1/master/offices/");
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not load offices."));
      }
      const json = await res.json();
      const results = (json.results || json) as OfficeOptionApi[];
      return results.map((office) => ({
        label: office.name,
        value: office.id,
      }));
    },
    enabled: isOpen,
    initialData: [] as { label: string; value: string | number }[],
  });

  const saveExpensesMutation = useMutation({
    mutationFn: async (data: ExpenseEntryValues) => {
      const payload = data.expenses.map(exp => ({
        date: data.date,
        office: data.office,
        ...exp
      }));

      const res = await fetchWithAuth("/api/v1/accounts/expenses/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not save expenses."));
      }

      return payload.length;
    },
    onSuccess: (savedCount) => {
      toast.success(`Successfully saved ${savedCount} expenses`);
      onSuccess();
      onOpenChange(false);
      reset();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error
          ? err.message
          : "Network error while saving expenses. Please check your connection.",
      );
    },
  });

  const onSubmit = (data: ExpenseEntryValues) => {
    saveExpensesMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Expense Entry</DialogTitle>
          <DialogDescription>
            Enter multiple expense records for a specific date and office.
          </DialogDescription>
        </DialogHeader>
        
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 gap-6 py-4">
            <div className="grid grid-cols-2 gap-6 p-4 rounded-md shadow-xl bg-input-background border border-input">
              <FormGroup 
                label={
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Transaction Date</span>
                  </div>
                } 
                error={errors.date?.message}
              >
                <CompactInput type="date" {...register("date")} className="bg-background" />
              </FormGroup>
              <FormGroup 
                label={
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Office / Branch</span>
                  </div>
                } 
                error={errors.office?.message}
              >
                <CompactSelect 
                  value={selectedOffice}
                  onValueChange={(val) => methods.setValue("office", val)}
                  options={officeOptions}
                  placeholder="Select branch for expenses"
                  className="bg-background"
                />
              </FormGroup>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-md shadow-xl bg-input-background border border-input">
              <div className="flex-1 overflow-y-auto">
                <Table>
                  <TableHeader sticky>
                    <TableRow>
                      <TableHead className="w-[30%]">Category / Item</TableHead>
                      <TableHead className="w-[20%]">Amount</TableHead>
                      <TableHead className="w-[40%]">Notes</TableHead>
                      <TableHead className="w-[10%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell className="p-2">
                          <CompactInput 
                            placeholder="e.g. Tea, Fuel, Rent"
                            {...register(`expenses.${index}.category`)}
                            className={cn(
                              "border-transparent focus-visible:border-primary/50",
                              errors.expenses?.[index]?.category && "border-destructive focus-visible:border-destructive"
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm font-medium">₹</span>
                            <CompactInput 
                              type="number" 
                              step="0.01"
                              placeholder="0.00"
                              {...register(`expenses.${index}.amount`)}
                              className={cn(
                                "pl-6 border-transparent focus-visible:border-primary/50 font-mono",
                                errors.expenses?.[index]?.amount && "border-destructive focus-visible:border-destructive"
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <CompactInput 
                            placeholder="Extra details..."
                            {...register(`expenses.${index}.notes`)}
                            className="border-transparent focus-visible:border-primary/50"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-3 border-none bg-muted/20 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ category: "", amount: 0, notes: "" })}
                  className="h-9 px-4 text-sm font-medium uppercase tracking-wider hover:bg-background shadow-none"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add New Line
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <div className="flex items-center justify-between w-full">
                <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  Total Items: {fields.length}
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => onOpenChange(false)} 
                    disabled={saveExpensesMutation.isPending}
                    className="h-9 px-4 text-sm font-medium"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saveExpensesMutation.isPending}
                    className="h-9 px-6 font-medium"
                  >
                    {saveExpensesMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Save Expenses
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        </FormProvider>

      </DialogContent>
    </Dialog>
  );
}
