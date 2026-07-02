"use client";

import {
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  Controller,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { docketSchema, type DocketFormValues } from "../_lib/schema";
import { createDocket, updateDocket, getDocket, type DocketDetail } from "../_lib/actions";
import { PartyInfo } from "./party-info";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, X } from "lucide-react";
import { getLocalDateValue, formatDateForInput } from "@/lib/utils";
import { fetchWithAuth, getAuthToken, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  FormGroup,
  FormLabel,
  CompactInput as StyledInput,
  CompactSelect,
  CompactTextarea,
} from "@/components/ui/form-elements";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionTitle, Surface } from "@/components/ui/surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type DocketPreviewLineItem = {
  charge: number;
};

type ComboboxOption = {
  label: string;
  value: string;
};

type SelectOption = string | { label: string; value: string };

const itemTypeOptions = [
  { label: "General", value: "GENERAL" },
  { label: "Hazardous", value: "HAZARDOUS" },
  { label: "Perishable", value: "PERISHABLE" },
  { label: "Fragile", value: "FRAGILE" },
];

const packageTypeOptions = [
  { label: "Box", value: "BOX" },
  { label: "Bag", value: "BAG" },
  { label: "Crate", value: "CRATE" },
  { label: "Bundle", value: "BUNDLE" },
  { label: "Pallet", value: "PALLET" },
];

const rateTypeOptions = [
  { label: "Per piece", value: "PER_PIECE" },
  { label: "Per kg", value: "PER_KG" },
  { label: "Flat rate", value: "FLAT" },
];

const basisOptions = [
  { label: "Paid", value: "PAID" },
  { label: "To Pay", value: "TO_PAY" },
  { label: "TBB", value: "TBB" },
];

const paymentOptionsMap: Record<string, { label: string; value: string }[]> = {
  PAID: [
    { label: "Cash", value: "CASH" },
    { label: "Bank/UPI", value: "BANK" },
  ],
  TO_PAY: [{ label: "Branch", value: "BRANCH" }],
  TBB: [{ label: "Credit", value: "CREDIT" }],
};

const modeOptions = [
  { label: "Road", value: "ROAD" },
  { label: "Air", value: "AIR" },
  { label: "Train", value: "TRAIN" },
  { label: "Sea", value: "SEA" },
];

const deliveryTypeOptions = [
  { label: "Door Delivery", value: "DOOR" },
  { label: "Office Collection", value: "OFFICE" },
];

const emptyLineItem = {
  item_type: "GENERAL",
  package_type: "BOX",
  rate_type: "PER_PIECE",
  pieces: 0,
  actual_weight: 0,
  charged_weight: 0,
  rate: 0,
  charge: 0,
} satisfies DocketFormValues["line_items"][number];

type DocketFormActionsContextValue = {
  canEdit: boolean;
  docketId?: string;
  isSubmitting: boolean;
  onCancel: () => void;
};

const DocketFormActionsContext =
  createContext<DocketFormActionsContextValue | null>(null);

function useDocketFormActions() {
  const context = useContext(DocketFormActionsContext);
  if (!context) {
    throw new Error(
      "DocketFormActions must be rendered inside NewDocketClient",
    );
  }

  return context;
}

export function DocketFormActions() {
  const { canEdit, docketId, isSubmitting, onCancel } = useDocketFormActions();

  return (
    <div className="shrink-0 bg-card py-3 flex justify-end gap-3 px-4 md:px-6 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primaryStrong"
        size="lg"
        disabled={isSubmitting || !canEdit}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {isSubmitting
          ? docketId
            ? "Updating..."
            : "Saving..."
          : docketId
            ? "Update"
            : "Save Docket"}
      </Button>
    </div>
  );
}

function DocketSelect({
  name,
  options,
  placeholder,
  className,
  onValueChange,
  disabled,
}: {
  name: string;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const { setValue, watch } = useFormContext();
  const currentValue = watch(name);
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );

  return (
    <CompactSelect
      value={currentValue}
      options={normalizedOptions}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      onValueChange={(value) => {
        setValue(name, value, {
          shouldValidate: true,
          shouldDirty: true,
        });
        onValueChange?.(value);
      }}
    />
  );
}

const DocketHeader = memo(function DocketHeader({
  metadata,
  canEdit,
}: {
  metadata: DocketMetadata;
  canEdit: boolean;
}) {
  const {
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<DocketFormValues>();
  const branches = useMemo(() => metadata.branches ?? [], [metadata.branches]);
  const cities = useMemo(() => metadata.cities ?? [], [metadata.cities]);
  const originBranch = watch("origin_branch") || "";
  const destinationBranch = watch("destination_branch") || "";
  const toCity = watch("to_city") || "";
  const basis = watch("basis");
  const needsOriginBranch = !metadata.user_branch;
  const filteredBranches = toCity
    ? branches.filter((branch) => String(branch.city) === toCity)
    : [];
  const allBranchOptions: ComboboxOption[] = branches.map((branch) => ({
    label: `${branch.name}${branch.city_name ? `, ${branch.city_name}` : ""}`,
    value: String(branch.id),
  }));
  const branchOptions: ComboboxOption[] = filteredBranches.map((branch) => ({
    label: branch.name,
    value: String(branch.id),
  }));
  const cityOptions: ComboboxOption[] = cities.map((city) => ({
    label: `${city.name}${city.state_code ? `, ${city.state_code}` : ""}`,
    value: String(city.id),
  }));
  const selectedOriginBranch =
    allBranchOptions.find((opt) => opt.value === originBranch) || null;
  const selectedDestinationBranch =
    branchOptions.find((opt) => opt.value === destinationBranch) || null;
  const selectedToCity =
    cityOptions.find((opt) => opt.value === toCity) || null;
  const paymentOptions = paymentOptionsMap[basis] || [];

  const handleToCityChange = (cityId: string) => {
    setValue("to_city", cityId, { shouldValidate: true, shouldDirty: true });
    setValue("consignee_city", cityId, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  useEffect(() => {
    if (!toCity) {
      if (destinationBranch) {
        setValue("destination_branch", "", {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
      return;
    }

    const cityBranches = branches.filter(
      (branch) => String(branch.city) === toCity,
    );
    const selectedBranch = branches.find(
      (branch) => String(branch.id) === destinationBranch,
    );

    if (cityBranches.length === 1) {
      const singleBranchId = String(cityBranches[0].id);
      if (destinationBranch !== singleBranchId) {
        setValue("destination_branch", singleBranchId, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    } else if (selectedBranch && String(selectedBranch.city) !== toCity) {
      setValue("destination_branch", "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [toCity, branches, destinationBranch, setValue]);

  const handleBasisChange = (val: string) => {
    setValue("basis", val, { shouldValidate: true, shouldDirty: true });
    const options = paymentOptionsMap[val] || [];
    if (options.length > 0) {
      setValue("payment_type", options[0].value, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
      {needsOriginBranch && (
        <FormGroup label="From Branch" error={errors.origin_branch?.message}>
          <Combobox<ComboboxOption>
            disabled={!canEdit}
            items={allBranchOptions}
            value={selectedOriginBranch}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.value}
            isItemEqualToValue={(item, value) => item.value === value.value}
            onValueChange={(val) => {
              setValue("origin_branch", val?.value || "", {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          >
            <ComboboxInput placeholder="Origin branch" />
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
        </FormGroup>
      )}

      <FormGroup label="Date" error={errors.date?.message}>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              placeholder="Pick a date"
              disabled={!canEdit}
            />
          )}
        />
      </FormGroup>

      <FormGroup label="To City">
        <Combobox<ComboboxOption>
          disabled={!canEdit}
          items={cityOptions}
          value={selectedToCity}
          itemToStringLabel={(item) => item.label}
          itemToStringValue={(item) => item.value}
          isItemEqualToValue={(item, value) => item.value === value.value}
          onValueChange={(val) => handleToCityChange(val?.value || "")}
        >
          <ComboboxInput placeholder="City" />
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
      </FormGroup>

      <FormGroup label="To Branch">
        <Combobox<ComboboxOption>
          disabled={!canEdit}
          items={branchOptions}
          value={selectedDestinationBranch}
          itemToStringLabel={(item) => item.label}
          itemToStringValue={(item) => item.value}
          isItemEqualToValue={(item, value) => item.value === value.value}
          onValueChange={(val) => {
            setValue("destination_branch", val?.value || "", {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        >
          <ComboboxInput
            placeholder={toCity ? "Branch" : "Select city first"}
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
      </FormGroup>

      <FormGroup label="Basis">
        <DocketSelect
          disabled={!canEdit}
          name="basis"
          options={basisOptions}
          onValueChange={handleBasisChange}
        />
      </FormGroup>

      <FormGroup label="Payment Type">
        <DocketSelect
          disabled={!canEdit}
          name="payment_type"
          options={paymentOptions}
        />
      </FormGroup>

      <FormGroup label="Mode">
        <DocketSelect disabled={!canEdit} name="mode" options={modeOptions} />
      </FormGroup>

      <FormGroup label="Delivery Type">
        <DocketSelect
          disabled={!canEdit}
          name="delivery_type"
          options={deliveryTypeOptions}
        />
      </FormGroup>
    </div>
  );
});

const LineItemsSection = memo(function LineItemsSection({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { register, control, watch, setValue } =
    useFormContext<DocketFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });
  const lineItems = watch("line_items");
  const syncTimeouts = useMemo(
    () => new Map<string, ReturnType<typeof setTimeout>>(),
    [],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      syncTimeouts.forEach(clearTimeout);
      syncTimeouts.clear();
    };
  }, [syncTimeouts]);

  return (
    <div className="lg:col-span-7 flex flex-col min-h-0">
      <Table
        containerClassName="flex-1 max-h-[320px] pr-2"
        className="min-w-[800px]"
      >
        <TableHeader sticky>
          <TableRow className="bg-muted text-muted-foreground font-bold uppercase tracking-widest text-xs hover:bg-muted">
            <TableHead className="py-1.5 px-1 w-48">Item</TableHead>
            <TableHead className="py-1.5 px-1 w-24">Type</TableHead>
            <TableHead className="py-1.5 px-1 w-28">Rate type</TableHead>
            <TableHead className="text-right py-1.5 px-1 w-16">Pcs</TableHead>
            <TableHead className="py-1.5 px-1 w-20">Actual wt</TableHead>
            <TableHead className="py-1.5 px-1 w-20">Charge wt</TableHead>
            <TableHead className="py-1.5 px-1 w-20">Rate</TableHead>
            <TableHead className="text-right py-1.5 px-1 w-20">Charge</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, idx) => (
            <TableRow
              key={field.id}
              className={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}
            >
              <TableCell className="py-1 px-1">
                <DocketSelect
                  disabled={!canEdit}
                  name={`line_items.${idx}.item_type`}
                  options={itemTypeOptions}
                />
              </TableCell>
              <TableCell className="py-1 px-1">
                <DocketSelect
                  disabled={!canEdit}
                  name={`line_items.${idx}.package_type`}
                  options={packageTypeOptions}
                />
              </TableCell>
              <TableCell className="py-1 px-1">
                <DocketSelect
                  disabled={!canEdit}
                  name={`line_items.${idx}.rate_type`}
                  options={rateTypeOptions}
                />
              </TableCell>
              <TableCell className="py-1 px-1">
                <StyledInput
                  disabled={!canEdit}
                  className="text-right"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register(`line_items.${idx}.pieces`)}
                />
              </TableCell>
              <TableCell className="py-1 px-1">
                <StyledInput
                  disabled={!canEdit}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register(`line_items.${idx}.actual_weight`, {
                    onChange: (e) => {
                      const value = e.target.value;
                      const existingTimeout = syncTimeouts.get(field.id);
                      if (existingTimeout) {
                        clearTimeout(existingTimeout);
                      }

                      const timeout = setTimeout(() => {
                        setValue(
                          `line_items.${idx}.charged_weight`,
                          Number(value || 0),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        );
                      }, 1200);

                      syncTimeouts.set(field.id, timeout);
                    },
                  })}
                />
              </TableCell>
              <TableCell className="py-1 px-1">
                <StyledInput
                  disabled={!canEdit}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register(`line_items.${idx}.charged_weight`)}
                />
              </TableCell>
              <TableCell className="py-1 px-1">
                <StyledInput
                  disabled={!canEdit}
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`line_items.${idx}.rate`)}
                />
              </TableCell>
              <TableCell className="py-1 px-1 font-bold text-right text-sm text-foreground">
                {lineItems[idx]?.charge || 0}
              </TableCell>
              <TableCell className="py-1 px-1 text-center">
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-destructive hover:text-destructive/80 transition-transform duration-150 active:scale-[0.98]"
                  disabled={!canEdit || fields.length === 1}
                >
                  <X className="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-center py-2 shrink-0 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canEdit}
          onClick={() => append({ ...emptyLineItem })}
        >
          + Add row
        </Button>
      </div>
    </div>
  );
});

const PaymentSection = memo(function PaymentSection({
  canEdit,
  backendTotals,
  gstData,
}: {
  canEdit: boolean;
  backendTotals: {
    freight: number;
    final_freight: number;
    balance: number;
  };
  gstData: {
    cgst: number;
    sgst: number;
    igst: number;
    hasGst: boolean;
    isSameState: boolean;
    citiesSelected: boolean;
  };
}) {
  const { register } = useFormContext<DocketFormValues>();
  const gstAmount =
    gstData.hasGst && gstData.citiesSelected
      ? gstData.isSameState
        ? gstData.cgst + gstData.sgst
        : gstData.igst
      : 0;
  const finalBalance = backendTotals.balance + gstAmount;

  return (
    <div className="lg:col-span-3 flex flex-col gap-4">
      <div>
        <SectionTitle>Payment Details</SectionTitle>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-meta">Package Total</span>
            <span className="text-sm font-bold">{backendTotals.freight}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-meta">Additional</span>
            <StyledInput
              disabled={!canEdit}
              className="text-right w-32"
              {...register("additional_charges")}
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-meta">Delivery</span>
            <StyledInput
              disabled={!canEdit}
              className="text-right w-32"
              {...register("delivery_charge")}
            />
          </div>

          {gstData.hasGst && (
            <div className="space-y-2 pt-2 border-t border-border">
              {!gstData.citiesSelected ? (
                <div className="text-[10px] text-muted-foreground italic text-center py-1">
                  Select origin & destination cities to calculate GST
                </div>
              ) : gstData.isSameState ? (
                <>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="text-xs uppercase tracking-wider">
                      CGST (9%)
                    </span>
                    <span className="text-sm font-medium">
                      {gstData.cgst.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="text-xs uppercase tracking-wider">
                      SGST (9%)
                    </span>
                    <span className="text-sm font-medium">
                      {gstData.sgst.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-xs uppercase tracking-wider">
                    IGST (18%)
                  </span>
                  <span className="text-sm font-medium">
                    {gstData.igst.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center gap-4 pt-2 border-t border-border">
            <span className="text-meta">Advance</span>
            <StyledInput
              disabled={!canEdit}
              className="text-right w-32"
              {...register("advance_amount")}
            />
          </div>
          <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-border">
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Balance
            </span>
            <span className="text-sm font-black text-foreground">
              {finalBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <FormLabel>Notes</FormLabel>
        <CompactTextarea
          {...register("notes")}
          disabled={!canEdit}
          placeholder="Enter additional notes here..."
          className="h-20"
        />
      </div>
    </div>
  );
});

export function DocketFormClient({
  children,
  docketId,
}: {
  children?: ReactNode;
  docketId?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metadata, setMetadata] = useState<DocketMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isLoadingDocket, setIsLoadingDocket] = useState(!!docketId);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const suggestedRateRequestRef = useRef(0);
  const previewCalculationRequestRef = useRef(0);

  const methods = useForm<DocketFormValues>({
    resolver: zodResolver(docketSchema) as Resolver<DocketFormValues>,
    defaultValues: {
      date: getLocalDateValue(),
      status: "BOOKED",
      origin_branch: "",
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
      basis: "PAID",
      payment_type: "CASH",
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
          pieces: 0,
          actual_weight: 0,
          charged_weight: 0,
          rate: 0,
          charge: 0,
        },
      ],
    },
  });

  const { handleSubmit, setValue, reset, control, setError } = methods;
  const { can } = useAuth();

  const canCreateDockets = can("shipment:create");
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const canEdit = docketId
    ? availableActions.includes("shipment:edit")
    : canCreateDockets;
  const canCancelDocket = availableActions.includes("shipment:edit");

  const [totals, setTotals] = useState({
    freight: 0,
    final_freight: 0,
    balance: 0,
  });

  const watchedCalculationFields = useWatch({
    control,
    name: [
      "line_items",
      "additional_charges",
      "delivery_charge",
      "advance_amount",
    ],
  });

  const watchedRouteFields = useWatch({
    control,
    name: ["origin_branch", "destination_branch", "basis"],
  });

  const watchedGstFields = useWatch({
    control,
    name: ["gst_number", "consignor_city", "consignee_city"],
  });

  const gstData = useMemo(() => {
    const [gst_number, consignor_city, consignee_city] = watchedGstFields;
    const hasGst = !!gst_number && gst_number.trim().length > 0;
    const citiesSelected = !!consignor_city && !!consignee_city;

    if (!hasGst) {
      return {
        cgst: 0,
        sgst: 0,
        igst: 0,
        hasGst: false,
        isSameState: true,
        citiesSelected: false,
      };
    }

    if (!citiesSelected || !metadata) {
      return {
        cgst: 0,
        sgst: 0,
        igst: 0,
        hasGst: true,
        isSameState: true,
        citiesSelected: false,
      };
    }

    const originCity = metadata.cities.find(
      (c) => String(c.id) === String(consignor_city),
    );
    const destCity = metadata.cities.find(
      (c) => String(c.id) === String(consignee_city),
    );

    if (!originCity || !destCity) {
      return {
        cgst: 0,
        sgst: 0,
        igst: 0,
        hasGst: true,
        isSameState: true,
        citiesSelected: false,
      };
    }

    const isSameState = originCity.state === destCity.state;
    const taxableAmount = totals.final_freight;

    if (isSameState) {
      const gst = Math.round(taxableAmount * 0.09 * 100) / 100;
      return {
        cgst: gst,
        sgst: gst,
        igst: 0,
        hasGst,
        isSameState,
        citiesSelected: true,
      };
    } else {
      const gst = Math.round(taxableAmount * 0.18 * 100) / 100;
      return {
        cgst: 0,
        sgst: 0,
        igst: gst,
        hasGst,
        isSameState,
        citiesSelected: true,
      };
    }
  }, [watchedGstFields, totals.final_freight, metadata]);

  useEffect(() => {
    const [origin_branch, destination_branch, basis] = watchedRouteFields;
    const origin_office = metadata?.user_branch || origin_branch;
    const requestId = ++suggestedRateRequestRef.current;

    if (!origin_office || !destination_branch || !basis) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetchWithAuth(
          `/api/v1/shipments/suggested-rate/?origin_office=${origin_office}&destination_office=${destination_branch}&basis=${basis}`,
          { signal: controller.signal },
        );

        if (requestId !== suggestedRateRequestRef.current) return;

        if (response.ok) {
          const data = await response.json();
          if (requestId !== suggestedRateRequestRef.current) return;

          if (data.rate !== null) {
            // Apply rate and rate_type to all line items that have 0 rate
            const currentLineItems = methods.getValues("line_items");
            currentLineItems.forEach((item, index) => {
              if (Number(item.rate) === 0) {
                setValue(`line_items.${index}.rate`, data.rate);
                setValue(`line_items.${index}.rate_type`, data.rate_type);
              }
            });

            // Also update delivery charge if it's 0
            if (Number(methods.getValues("delivery_charge")) === 0) {
              setValue("delivery_charge", data.delivery_charge);
            }

            toast.info(`Suggested rate of ${data.rate} applied.`);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch suggested rate:", err);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [watchedRouteFields, metadata?.user_branch, setValue, methods]);

  useEffect(() => {
    const [line_items, additional_charges, delivery_charge, advance_amount] =
      watchedCalculationFields as [
        DocketFormValues["line_items"],
        number,
        number,
        number,
      ];

    const requestId = ++previewCalculationRequestRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetchWithAuth("/api/v1/shipments/preview/", {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            line_items,
            additional_charges,
            delivery_charge,
            advance_amount,
          }),
        });

        if (requestId !== previewCalculationRequestRef.current) return;

        if (response.ok) {
          const data = await response.json();
          if (requestId !== previewCalculationRequestRef.current) return;

          // Update line item charges in form state
          data.line_items.forEach(
            (item: DocketPreviewLineItem, index: number) => {
              if (
                line_items[index] &&
                line_items[index].charge !== item.charge
              ) {
                // Use { shouldDirty: false } to avoid marking form as dirty just from calculations
                setValue(`line_items.${index}.charge`, item.charge, {
                  shouldDirty: false,
                });
              }
            },
          );

          setTotals({
            freight: data.freight,
            final_freight: data.final_freight,
            balance: data.remaining_balance,
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Preview calculation failed:", err);
      }
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [watchedCalculationFields, setValue]);

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
      try {
        const response = await fetchWithAuth("/api/v1/shipments/metadata/", {
          headers: { "X-Use-Primary-DB": "true" },
        });

        if (response.status === 401) return;

        if (!response.ok) {
          throw new Error(await readApiError(response, `Metadata request failed (${response.status}).`));
        }

        const metadataData = await response.json();

        if (metadataData.parties && !Array.isArray(metadataData.parties)) {
          metadataData.parties = metadataData.parties.results || [];
        }

        if (!metadataData.parties || metadataData.parties.length === 0) {
          try {
            const partiesRes = await fetchWithAuth("/api/v1/master/parties/");
            if (partiesRes.ok) {
              const partiesData = await partiesRes.json();
              metadataData.parties = Array.isArray(partiesData)
                ? partiesData
                : partiesData.results || [];
            }
          } catch (err) {
            console.error("Failed to fetch parties from master API", err);
          }
        }

        setMetadata(metadataData as DocketMetadata);

        if (docketId) {
          const docketResult = await getDocket(docketId);
          if (docketResult.success && docketResult.data) {
            const docket = docketResult.data as DocketDetail;
            setAvailableActions(docket.available_actions || []);
            reset({
              ...docket,
              date: formatDateForInput(docket.date),
              origin_branch: String(docket.origin_office || ""),
              to_city: String(docket.to_city),
              destination_branch: String(docket.destination_branch),
              consignor_city: String(docket.consignor_city),
              consignee_city: String(docket.consignee_city),
              additional_charges: Number(docket.additional_charges),
              delivery_charge: Number(docket.delivery_charge),
              advance_amount: Number(docket.advance_amount),
              line_items: docket.line_items.map((item) => ({
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
  }, [docketId, reset]);

  useEffect(() => {
    if (docketId) return;
    setValue(
      "idempotency_key",
      crypto.randomUUID?.() || Math.random().toString(36).substring(7),
    );
  }, [docketId, setValue]);

  const onSubmit = async (data: DocketFormValues) => {
    if (!canEdit) {
      toast.error("You do not have permission to save this docket.");
      return;
    }

    if (!metadata?.user_branch && !data.origin_branch) {
      setError("origin_branch", {
        type: "manual",
        message: "Origin branch is required.",
      });
      toast.error("Select an origin branch before saving this docket.");
      return;
    }

    setIsSubmitting(true);
    let resetSubmitting = true;

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Session expired.");
        router.push("/");
        return;
      }

      const result = docketId
        ? await updateDocket(docketId, data, token)
        : await createDocket(data, token);

      if (result.success) {
        resetSubmitting = false;
        toast.success(`Docket ${docketId ? "updated" : "created"} successfully!`);
        setTimeout(() => {
          router.push("/dockets");
          router.refresh();
        }, 1500);
      } else {
        toast.error(result.error || "Failed to save");
      }
    } catch (error) {
      console.error("Docket save error:", error);
      toast.error("Failed to save");
    } finally {
      if (resetSubmitting) {
        setIsSubmitting(false);
      }
    }
  };

  const cancelDocket = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetchWithAuth(`/api/v1/shipments/${docketId}/cancel/`, {
        method: "POST",
      });

      if (response.ok) {
        setValue("status", "CANCELLED");
        toast.success("Docket cancelled.");
        return true;
      } else {
        if (response.status === 401) return false;
        toast.error(await readApiError(response, "Could not cancel docket."));
        return false;
      }
    } catch {
      toast.error(
        "Network error while cancelling docket. Please check your connection.",
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    const success = await cancelDocket();
    if (success) {
      setIsCancelDialogOpen(false);
      router.push("/dockets");
      router.refresh();
    }
  };

  const handleCancelAction = () => {
    if (canCancelDocket && docketId) {
      setIsCancelDialogOpen(true);
    } else {
      router.back();
    }
  };

  const actionsContext: DocketFormActionsContextValue = {
    canEdit,
    docketId,
    isSubmitting,
    onCancel: handleCancelAction,
  };

  return (
    <FormProvider {...methods}>
      <DocketFormActionsContext.Provider value={actionsContext}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="h-full flex flex-col min-h-0 bg-background"
        >
          <div
            className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 md:p-6 gap-4"
          >
            {isLoadingMetadata || isLoadingDocket || !metadata ? (
              <div className="space-y-8 animate-pulse">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-2 w-12 bg-muted rounded-md" />
                      <div className="h-9 w-full bg-muted rounded-md" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="h-40 bg-muted rounded-md" />
                  <div className="h-40 bg-muted rounded-md" />
                </div>
              </div>
            ) : (
              <>
                <Surface>
                  <DocketHeader metadata={metadata} canEdit={canEdit} />
                </Surface>
                <Surface>
                  <PartyInfo
                    metadata={metadata}
                    onPartySaved={handlePartySaved}
                  />
                </Surface>
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-10 mb-6">
                  <Surface className="lg:col-span-7">
                    <LineItemsSection canEdit={canEdit} />
                  </Surface>
                  <Surface className="lg:col-span-3">
                    <PaymentSection
                      canEdit={canEdit}
                      backendTotals={totals}
                      gstData={gstData}
                    />
                  </Surface>
                </div>
              </>
            )}
          </div>

          {!isLoadingMetadata && !isLoadingDocket && metadata ? children : null}

          <AlertDialog
            open={isCancelDialogOpen}
            onOpenChange={setIsCancelDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDialogTitle>Cancel Shipment?</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  This action will cancel the shipment and all associated
                  receipts. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  No, keep it
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    confirmCancel();
                  }}
                  disabled={isSubmitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Yes, cancel shipment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </DocketFormActionsContext.Provider>
    </FormProvider>
  );
}
