"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getDocket,
  type DocketDetail,
  type DocketLineItem,
} from "@/app/dockets/_lib/actions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { docketKeys } from "@/lib/query-keys";

type DocketPrintValue = string | number | null | undefined;

type PrintMembership = {
  company_name?: string | null;
  branch_name?: string | null;
} | null;

type PrintMetadataItem = {
  id: string | number;
  name: string;
  state?: string | number | null;
  state_code?: string | null;
  city?: string | number | null;
};

type PrintMetadata = {
  cities?: PrintMetadataItem[];
  branches?: PrintMetadataItem[];
};

type DocketPrintData = DocketDetail & {
  to_city_name?: string | null;
  consignor_city_name?: string | null;
  consignee_city_name?: string | null;
  origin_office_name?: string | null;
  destination_office?: string | number | null;
  destination_office_name?: string | null;
  destination_branch?: string | number | null;
  destination_branch_name?: string | null;
  freight?: string | number | null;
  final_freight?: string | number | null;
  remaining_balance?: string | number | null;
  total_packages?: string | number | null;
  total_actual_weight?: string | number | null;
  total_charge_weight?: string | number | null;
};

type DocketViewProps = {
  docket: DocketPrintData;
  metadata: PrintMetadata | null;
  membership?: PrintMembership;
};

type ReceiptDensity = "roomy" | "compact" | "dense" | "micro";

type ReceiptVariant = {
  key: string;
  title: string;
  sizeLabel: string;
  page: string;
  sheet: string;
  density: ReceiptDensity;
  columns: "single" | "double";
  accent: "top" | "side" | "boxed" | "plain";
};

const variants: ReceiptVariant[] = [
  {
    key: "v1",
    title: "Half Page",
    sizeLabel: "A5 landscape",
    page: "@page { size: 210mm 148.5mm; margin: 4mm; }",
    sheet: "w-[210mm] min-h-[148.5mm]",
    density: "roomy",
    columns: "double",
    accent: "top",
  },
  {
    key: "v2",
    title: "Half Portrait",
    sizeLabel: "A5 portrait",
    page: "@page { size: 148.5mm 210mm; margin: 4mm; }",
    sheet: "w-[148.5mm] min-h-[210mm]",
    density: "roomy",
    columns: "single",
    accent: "side",
  },
  {
    key: "v3",
    title: "Third Strip",
    sizeLabel: "1/3 page horizontal",
    page: "@page { size: 210mm 99mm; margin: 3mm; }",
    sheet: "w-[210mm] min-h-[99mm]",
    density: "compact",
    columns: "double",
    accent: "plain",
  },
  {
    key: "v4",
    title: "Quarter",
    sizeLabel: "A6 portrait",
    page: "@page { size: 105mm 148.5mm; margin: 3mm; }",
    sheet: "w-[105mm] min-h-[148.5mm]",
    density: "dense",
    columns: "single",
    accent: "boxed",
  },
  {
    key: "v5",
    title: "Thermal",
    sizeLabel: "80mm roll",
    page: "@page { size: 80mm auto; margin: 2mm; }",
    sheet: "w-[80mm]",
    density: "micro",
    columns: "single",
    accent: "plain",
  },
  {
    key: "v6",
    title: "Half Dense",
    sizeLabel: "A5 landscape dense",
    page: "@page { size: 210mm 148.5mm; margin: 3mm; }",
    sheet: "w-[210mm] min-h-[148.5mm]",
    density: "compact",
    columns: "double",
    accent: "boxed",
  },
  {
    key: "v7",
    title: "Quarter Wide",
    sizeLabel: "A6 landscape",
    page: "@page { size: 148.5mm 105mm; margin: 3mm; }",
    sheet: "w-[148.5mm] min-h-[105mm]",
    density: "dense",
    columns: "double",
    accent: "top",
  },
  {
    key: "v8",
    title: "Third Portrait",
    sizeLabel: "1/3 page portrait",
    page: "@page { size: 99mm 210mm; margin: 3mm; }",
    sheet: "w-[99mm] min-h-[210mm]",
    density: "dense",
    columns: "single",
    accent: "side",
  },
  {
    key: "v9",
    title: "Data Third",
    sizeLabel: "1/3 page horizontal",
    page: "@page { size: 210mm 99mm; margin: 2.5mm; }",
    sheet: "w-[210mm] min-h-[99mm]",
    density: "micro",
    columns: "double",
    accent: "plain",
  },
  {
    key: "v10",
    title: "Quarter Dense",
    sizeLabel: "A6 portrait dense",
    page: "@page { size: 105mm 148.5mm; margin: 2.5mm; }",
    sheet: "w-[105mm] min-h-[148.5mm]",
    density: "micro",
    columns: "single",
    accent: "boxed",
  },
];

const num = (val: DocketPrintValue) => {
  const parsed = parseFloat(String(val ?? ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const text = (val: DocketPrintValue, fallback = "-") => {
  if (val === null || val === undefined || val === "") return fallback;
  return String(val);
};

const money = (val: DocketPrintValue) =>
  `Rs. ${num(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dateText = (val: DocketPrintValue) => {
  if (!val) return "-";
  const date = new Date(String(val));
  if (Number.isNaN(date.getTime())) return String(val);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const normalize = (val: DocketPrintValue) => text(val).replaceAll("_", " ");

const densityClass = {
  roomy: {
    pad: "p-5",
    gap: "gap-3",
    section: "p-2.5",
    h1: "text-[15px]",
    body: "text-[9.5px]",
    small: "text-[8px]",
    table: "text-[8.5px]",
    cell: "px-1.5 py-1",
  },
  compact: {
    pad: "p-3",
    gap: "gap-2",
    section: "p-2",
    h1: "text-[12px]",
    body: "text-[8px]",
    small: "text-[7px]",
    table: "text-[7.5px]",
    cell: "px-1 py-0.5",
  },
  dense: {
    pad: "p-2.5",
    gap: "gap-1.5",
    section: "p-1.5",
    h1: "text-[10px]",
    body: "text-[7px]",
    small: "text-[6.5px]",
    table: "text-[6.5px]",
    cell: "px-0.5 py-0.5",
  },
  micro: {
    pad: "p-2",
    gap: "gap-1",
    section: "p-1",
    h1: "text-[8.5px]",
    body: "text-[6.3px]",
    small: "text-[5.8px]",
    table: "text-[5.8px]",
    cell: "px-0.5 py-[1px]",
  },
} satisfies Record<ReceiptDensity, Record<string, string>>;

export default function PrintDocketContent() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const version = searchParams.get("v") || "v1";
  const { activeMembership } = useAuth();
  const router = useRouter();

  const docketQuery = useQuery({
    queryKey: docketKeys.detail(activeMembership?.id, id),
    queryFn: async ({ signal }) => {
      const docketResult = await getDocket(id, { signal });
      if (docketResult.success && docketResult.data) {
        return docketResult.data as DocketPrintData;
      }
      throw new Error(docketResult.error || "Could not load this docket.");
    },
  });

  const metadataQuery = useQuery({
    queryKey: docketKeys.printMetadata(activeMembership?.id),
    queryFn: async ({ signal }) => {
      const metadataResponse = await fetchWithAuth(
        "/api/v1/shipments/metadata/",
        { signal },
      );
      if (!metadataResponse.ok) {
        throw new Error(
          await readApiError(metadataResponse, "Could not load print metadata."),
        );
      }
      return (await metadataResponse.json()) as PrintMetadata;
    },
  });

  const docket = docketQuery.data || null;
  const metadata = metadataQuery.data || null;
  const loading = docketQuery.isLoading || metadataQuery.isLoading;

  useEffect(() => {
    [docketQuery.error, metadataQuery.error].forEach((error) => {
      if (error instanceof Error) toast.error(error.message);
    });
  }, [docketQuery.error, metadataQuery.error]);

  const resolveCity = (
    cityId: DocketPrintValue,
    cityName: DocketPrintValue,
  ): string | null | undefined => {
    if (cityName) return String(cityName);
    if (!cityId || !metadata?.cities) return cityId == null ? cityId : String(cityId);
    const city = metadata.cities.find((item) => String(item.id) === String(cityId));
    return city ? city.name : String(cityId);
  };

  const resolveBranch = (
    branchId: DocketPrintValue,
    branchName: DocketPrintValue,
  ): string | null | undefined => {
    if (branchName) return String(branchName);
    if (!branchId || !metadata?.branches) return branchId == null ? branchId : String(branchId);
    const branch = metadata.branches.find((item) => String(item.id) === String(branchId));
    return branch ? branch.name : String(branchId);
  };

  useEffect(() => {
    if (!loading && docket && metadata) {
      const timer = setTimeout(() => window.print(), 800);
      const handleAfterPrint = () => window.close();
      window.addEventListener("afterprint", handleAfterPrint);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }
  }, [loading, docket, metadata, version]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!docket) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Docket not found</p>
      </div>
    );
  }

  const enrichedDocket: DocketPrintData = {
    ...docket,
    to_city_name: resolveCity(docket.to_city, docket.to_city_name),
    consignor_city_name: resolveCity(docket.consignor_city, docket.consignor_city_name),
    consignee_city_name: resolveCity(docket.consignee_city, docket.consignee_city_name),
    origin_office_name: resolveBranch(docket.origin_office, docket.origin_office_name),
    destination_office_name: resolveBranch(
      docket.destination_office ?? docket.destination_branch,
      docket.destination_office_name ?? docket.destination_branch_name,
    ),
  };

  const selectedVariant =
    variants.find((item) => item.key === version) ?? variants[0];

  return (
    <div className="relative font-sans text-zinc-950">
      <style>{`${selectedVariant.page}
        @media print {
          html, body { margin: 0 !important; background: white !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }`}</style>
      <div className="print:hidden fixed top-4 left-4 z-50 flex gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-md shadow-xl overflow-x-auto max-w-[95vw]">
        {variants.map((item) => (
          <button
            key={item.key}
            onClick={() => router.push(`/dockets/${id}/print?v=${item.key}`)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              selectedVariant.key === item.key
                ? "bg-zinc-950 text-white shadow-lg"
                : "hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950"
            }`}
            title={item.sizeLabel}
          >
            {item.key.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="print:m-0 min-h-screen bg-zinc-50 py-12 print:py-0 print:bg-white">
        <DocketReceipt
          docket={enrichedDocket}
          metadata={metadata}
          membership={activeMembership}
          variant={selectedVariant}
        />
      </div>
    </div>
  );
}

function DocketReceipt({
  docket,
  metadata,
  membership,
  variant,
}: DocketViewProps & { variant: ReceiptVariant }) {
  const d = densityClass[variant.density];
  const companyName = docket.company_name || membership?.company_name || "METRO LOGISTICS";
  const totals = buildTotals(docket, metadata);
  const route = `${text(docket.origin_office_name || membership?.branch_name)} to ${text(docket.destination_office_name || docket.to_city_name)}`;
  const sideAccent = variant.accent === "side";

  return (
    <div
      className={`${variant.sheet} mx-auto bg-white text-zinc-950 shadow-2xl print:shadow-none print:m-0 overflow-hidden rounded-md print:rounded-none ${d.body} leading-tight`}
    >
      <div className={sideAccent ? "grid grid-cols-[7mm_1fr] min-h-inherit" : ""}>
        {sideAccent ? (
          <div className="bg-zinc-950 text-white flex items-center justify-center">
            <div className="[writing-mode:vertical-rl] rotate-180 uppercase font-black text-[7px] tracking-normal">
              {variant.title}
            </div>
          </div>
        ) : null}

        <div className={`${d.pad} flex flex-col ${d.gap}`}>
          <ReceiptHeader
            companyName={companyName}
            docket={docket}
            route={route}
            variant={variant}
          />

          <div
            className={
              variant.columns === "double"
                ? `grid grid-cols-[1.1fr_0.9fr] ${d.gap}`
                : `grid grid-cols-1 ${d.gap}`
            }
          >
            <div className={`flex flex-col ${d.gap}`}>
              <RouteSection docket={docket} density={variant.density} />
              <PartiesSection docket={docket} density={variant.density} />
              <ItemsSection docket={docket} density={variant.density} />
            </div>
            <div className={`flex flex-col ${d.gap}`}>
              <BillingSection docket={docket} totals={totals} density={variant.density} />
              <NotesSection docket={docket} density={variant.density} />
              <AcknowledgementSection density={variant.density} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptHeader({
  companyName,
  docket,
  route,
  variant,
}: {
  companyName: string;
  docket: DocketPrintData;
  route: string;
  variant: ReceiptVariant;
}) {
  const d = densityClass[variant.density];
  const boxed = variant.accent === "boxed";

  return (
    <div
      className={`${
        variant.accent === "top" ? "border-t-[4px] border-zinc-950 pt-2" : ""
      } ${boxed ? "bg-zinc-950 text-white" : "bg-white"} ${boxed ? d.section : ""} rounded-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div
              className={`${
                boxed ? "bg-white text-zinc-950" : "bg-zinc-950 text-white"
              } h-5 w-5 shrink-0 rounded-sm flex items-center justify-center text-[9px] font-black italic`}
            >
              M
            </div>
            <h1 className={`${d.h1} font-black uppercase truncate tracking-normal`}>
              {companyName}
            </h1>
          </div>
          <p className={`${d.small} mt-1 font-semibold ${boxed ? "text-zinc-200" : "text-zinc-500"} truncate`}>
            {route}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`${d.small} font-black uppercase ${boxed ? "text-zinc-300" : "text-zinc-500"}`}>
            Docket
          </p>
          <p className={`${d.h1} font-black font-mono leading-none break-all`}>
            {text(docket.docket_no || docket.lr_no)}
          </p>
          <p className={`${d.small} mt-1 font-bold`}>{dateText(docket.date)}</p>
        </div>
      </div>
      <div className={`mt-1 grid grid-cols-4 gap-1 ${d.small} font-bold uppercase`}>
        <Tiny label="Status" value={normalize(docket.status)} boxed={boxed} />
        <Tiny label="Basis" value={normalize(docket.basis)} boxed={boxed} />
        <Tiny label="Payment" value={normalize(docket.payment_type)} boxed={boxed} />
        <Tiny label="Mode" value={normalize(docket.mode)} boxed={boxed} />
      </div>
    </div>
  );
}

function RouteSection({
  docket,
  density,
}: {
  docket: DocketPrintData;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  return (
    <Section title="Route & Booking" density={density}>
      <div className={`grid grid-cols-2 ${d.gap}`}>
        <Field label="From branch" value={docket.origin_office_name} density={density} />
        <Field label="To branch" value={docket.destination_office_name || docket.destination_branch_name} density={density} />
        <Field label="To city" value={docket.to_city_name} density={density} />
        <Field label="Delivery type" value={normalize(docket.delivery_type)} density={density} />
      </div>
    </Section>
  );
}

function PartiesSection({
  docket,
  density,
}: {
  docket: DocketPrintData;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  return (
    <Section title="Consignor & Consignee" density={density}>
      <div className={`grid grid-cols-2 ${d.gap}`}>
        <Party
          title="Consignor"
          name={docket.consignor_name}
          city={docket.consignor_city_name}
          phone={docket.consignor_phone}
          address={docket.consignor_address}
          density={density}
        />
        <Party
          title="Consignee"
          name={docket.consignee_name}
          city={docket.consignee_city_name}
          phone={docket.consignee_phone}
          address={docket.consignee_address}
          density={density}
        />
      </div>
    </Section>
  );
}

function ItemsSection({
  docket,
  density,
}: {
  docket: DocketPrintData;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  const lineItems = docket.line_items || [];

  return (
    <Section title={`Line Items (${lineItems.length})`} density={density}>
      <table className={`w-full ${d.table} leading-tight`}>
        <thead>
          <tr className="bg-zinc-950 text-white uppercase">
            <th className={`${d.cell} text-left font-black`}>Item</th>
            <th className={`${d.cell} text-left font-black`}>Pkg</th>
            <th className={`${d.cell} text-left font-black`}>Rate type</th>
            <th className={`${d.cell} text-right font-black`}>Pcs</th>
            <th className={`${d.cell} text-right font-black`}>Act wt</th>
            <th className={`${d.cell} text-right font-black`}>Chg wt</th>
            <th className={`${d.cell} text-right font-black`}>Rate</th>
            <th className={`${d.cell} text-right font-black`}>Charge</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item: DocketLineItem, idx: number) => (
            <tr key={item.id ?? idx} className={idx % 2 === 0 ? "bg-zinc-50" : "bg-white"}>
              <td className={`${d.cell} font-bold uppercase`}>{text(item.item_type)}</td>
              <td className={`${d.cell} uppercase`}>{text(item.package_type)}</td>
              <td className={`${d.cell} uppercase`}>{normalize(item.rate_type)}</td>
              <td className={`${d.cell} text-right font-bold`}>{num(item.pieces)}</td>
              <td className={`${d.cell} text-right`}>{num(item.actual_weight).toFixed(2)}</td>
              <td className={`${d.cell} text-right font-bold`}>{num(item.charged_weight).toFixed(2)}</td>
              <td className={`${d.cell} text-right`}>{num(item.rate).toFixed(2)}</td>
              <td className={`${d.cell} text-right font-black`}>{num(item.charge).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`grid grid-cols-3 gap-1 border-t border-zinc-200 pt-1 ${d.small} font-bold`}>
        <span>Total packages: {text(docket.total_packages || lineItems.reduce((sum, item) => sum + num(item.pieces), 0))}</span>
        <span>Actual wt: {text(docket.total_actual_weight || lineItems.reduce((sum, item) => sum + num(item.actual_weight), 0).toFixed(2))}</span>
        <span>Charge wt: {text(docket.total_charge_weight || lineItems.reduce((sum, item) => sum + num(item.charged_weight), 0).toFixed(2))}</span>
      </div>
    </Section>
  );
}

function BillingSection({
  docket,
  totals,
  density,
}: {
  docket: DocketPrintData;
  totals: ReturnType<typeof buildTotals>;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  return (
    <Section title="Billing, GST & Balance" density={density}>
      <div className={`grid grid-cols-2 ${d.gap}`}>
        <Field label="GST party" value={docket.gst_party || docket.consignor_name} density={density} />
        <Field label="GSTIN" value={docket.gst_number || "Not provided"} density={density} />
      </div>
      <div className={`mt-1 ${d.small} space-y-0.5`}>
        <MoneyRow label="Package total" value={totals.freight} />
        <MoneyRow label="Additional charges" value={totals.additional} />
        <MoneyRow label="Delivery charge" value={totals.delivery} />
        <MoneyRow label="Taxable freight" value={totals.taxable} strong />
        {totals.hasGst ? (
          totals.isSameState ? (
            <>
              <MoneyRow label="CGST 9%" value={totals.cgst} />
              <MoneyRow label="SGST 9%" value={totals.sgst} />
            </>
          ) : (
            <MoneyRow label="IGST 18%" value={totals.igst} />
          )
        ) : (
          <MoneyRow label="GST" value={0} note="No GSTIN" />
        )}
        <MoneyRow label="Advance paid" value={totals.advance} />
        <div className="mt-1 bg-zinc-950 text-white rounded-sm px-1.5 py-1 flex justify-between font-black">
          <span>Client payable balance</span>
          <span>{money(totals.clientBalance)}</span>
        </div>
      </div>
    </Section>
  );
}

function NotesSection({
  docket,
  density,
}: {
  docket: DocketPrintData;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  return (
    <Section title="Notes & Client Copy" density={density}>
      <p className={`${d.small} text-zinc-700`}>
        {text(docket.notes, "No special notes recorded. Client to verify consignor, consignee, GST, goods, charges, advance and balance before accepting.")}
      </p>
      <p className={`${d.small} mt-1 font-semibold text-zinc-500`}>
        This compact print is a client-facing docket copy and includes the booking data from /dockets/new.
      </p>
    </Section>
  );
}

function AcknowledgementSection({ density }: { density: ReceiptDensity }) {
  const d = densityClass[density];
  return (
    <div className={`grid grid-cols-2 gap-2 ${d.small} text-center`}>
      <div className="border-t border-zinc-300 pt-1 font-bold text-zinc-500">Client signature</div>
      <div className="border-t border-zinc-300 pt-1 font-bold text-zinc-500">Authorized sign</div>
    </div>
  );
}

function Section({
  title,
  density,
  children,
}: {
  title: string;
  density: ReceiptDensity;
  children: React.ReactNode;
}) {
  const d = densityClass[density];
  return (
    <section className={`border border-zinc-200 rounded-sm ${d.section} break-inside-avoid`}>
      <h2 className={`${d.small} font-black uppercase text-zinc-500 mb-1 tracking-normal`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  density,
}: {
  label: string;
  value: DocketPrintValue;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  return (
    <div className="min-w-0">
      <p className={`${d.small} uppercase font-black text-zinc-400`}>{label}</p>
      <p className={`${d.body} font-bold text-zinc-950 break-words`}>{text(value)}</p>
    </div>
  );
}

function Party({
  title,
  name,
  city,
  phone,
  address,
  density,
}: {
  title: string;
  name: DocketPrintValue;
  city: DocketPrintValue;
  phone: DocketPrintValue;
  address: DocketPrintValue;
  density: ReceiptDensity;
}) {
  const d = densityClass[density];
  return (
    <div className="min-w-0">
      <p className={`${d.small} uppercase font-black text-zinc-400`}>{title}</p>
      <p className={`${d.body} font-black break-words`}>{text(name)}</p>
      <p className={`${d.small} font-bold text-zinc-600 break-words`}>
        {text(city)} / {text(phone)}
      </p>
      <p className={`${d.small} text-zinc-500 break-words`}>{text(address)}</p>
    </div>
  );
}

function Tiny({
  label,
  value,
  boxed,
}: {
  label: string;
  value: DocketPrintValue;
  boxed?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className={boxed ? "text-zinc-300" : "text-zinc-400"}>{label}: </span>
      <span className="break-words">{text(value)}</span>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong,
  note,
}: {
  label: string;
  value: number;
  strong?: boolean;
  note?: string;
}) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? "font-black" : "font-semibold"}`}>
      <span>{label}{note ? ` (${note})` : ""}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function buildTotals(docket: DocketPrintData, metadata: PrintMetadata | null) {
  const lineFreight = (docket.line_items || []).reduce(
    (sum, item) => sum + num(item.charge),
    0,
  );
  const freight = num(docket.freight) || lineFreight;
  const additional = num(docket.additional_charges);
  const delivery = num(docket.delivery_charge);
  const taxable = num(docket.final_freight) || num(docket.total_amount) || freight + additional + delivery;
  const advance = num(docket.advance_amount);
  const baseBalance = num(docket.remaining_balance) || Math.max(taxable - advance, 0);
  const hasGst = Boolean(docket.gst_number);
  const isSameState = resolveSameState(docket, metadata);
  const cgst = hasGst && isSameState ? roundMoney(taxable * 0.09) : 0;
  const sgst = hasGst && isSameState ? roundMoney(taxable * 0.09) : 0;
  const igst = hasGst && !isSameState ? roundMoney(taxable * 0.18) : 0;
  const gst = cgst + sgst + igst;

  return {
    freight,
    additional,
    delivery,
    taxable,
    advance,
    baseBalance,
    hasGst,
    isSameState,
    cgst,
    sgst,
    igst,
    gst,
    clientBalance: baseBalance + gst,
  };
}

function resolveSameState(docket: DocketPrintData, metadata: PrintMetadata | null) {
  const cities = metadata?.cities || [];
  const consignorCity = cities.find((city) => String(city.id) === String(docket.consignor_city));
  const consigneeCity = cities.find((city) => String(city.id) === String(docket.consignee_city));
  const consignorState = consignorCity?.state ?? consignorCity?.state_code;
  const consigneeState = consigneeCity?.state ?? consigneeCity?.state_code;

  if (!consignorState || !consigneeState) return true;
  return String(consignorState) === String(consigneeState);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
