"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getDocket,
  type DocketDetail,
  type DocketLineItem,
} from "@/app/dockets/_lib/actions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchWithAuth, readApiError } from "@/lib/api";

type DocketPrintValue = string | number | null | undefined;

type PrintMembership = {
  company_name?: string | null;
  branch_name?: string | null;
} | null;

type PrintMetadataItem = {
  id: string | number;
  name: string;
};

type PrintMetadata = {
  cities?: PrintMetadataItem[];
  branches?: PrintMetadataItem[];
};

type DocketPrintData = Omit<
  DocketDetail,
  | "to_city_name"
  | "consignor_city_name"
  | "consignee_city_name"
  | "origin_office_name"
  | "destination_branch_name"
> & {
  to_city_name?: string | null;
  consignor_city_name?: string | null;
  consignee_city_name?: string | null;
  origin_office_name?: string | null;
  destination_branch_name?: string | null;
};

type DocketViewProps = {
  docket: DocketPrintData;
};

type DocketMembershipViewProps = DocketViewProps & {
  membership: PrintMembership;
};

const num = (val: DocketPrintValue) => {
  const n = parseFloat(String(val ?? ""));
  return isNaN(n) ? 0 : n;
};

const fmtNo = (val: DocketPrintValue) => {
  if (!val) return "N/A";
  if (typeof val === 'string' && val.length > 12) return val.substring(0, 8);
  return val;
};

export default function PrintDocketContent() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const version = searchParams.get("v") || "v1";
  const [docket, setDocket] = useState<DocketDetail | null>(null);
  const [metadata, setMetadata] = useState<PrintMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeMembership } = useAuth();

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docketResult, metadataResponse] = await Promise.all([
          getDocket(id),
          fetchWithAuth("/api/v1/shipments/metadata/")
        ]);

        if (docketResult.success && docketResult.data) {
          setDocket(docketResult.data);
        } else {
          toast.error(docketResult.error || "Could not load this docket.");
        }

        if (metadataResponse.ok) {
          setMetadata(await metadataResponse.json());
        } else if (metadataResponse.status !== 401) {
          toast.error(
            await readApiError(metadataResponse, "Could not load print metadata."),
          );
        }
      } catch (err) {
        console.error("Print page fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const resolveCity = (cityId: DocketPrintValue, cityName: DocketPrintValue): string | null | undefined => {
    if (cityName) return String(cityName);
    if (!cityId || !metadata?.cities) return cityId == null ? cityId : String(cityId);
    const city = metadata.cities.find((c) => String(c.id) === String(cityId));
    return city ? city.name : String(cityId);
  };

  const resolveBranch = (branchId: DocketPrintValue, branchName: DocketPrintValue): string | null | undefined => {
    if (branchName) return String(branchName);
    if (!branchId || !metadata?.branches) return branchId == null ? branchId : String(branchId);
    const branch = metadata.branches.find((b) => String(b.id) === String(branchId));
    return branch ? branch.name : String(branchId);
  };

  useEffect(() => {
    if (!loading && docket && metadata) {
      // Small delay to ensure styles and images are loaded/rendered
      const timer = setTimeout(() => {
        window.print();
      }, 800);

      const handleAfterPrint = () => {
        window.close();
      };

      window.addEventListener("afterprint", handleAfterPrint);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }
  }, [loading, docket, metadata]);

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

  const enrichedDocket = {
    ...docket,
    to_city_name: resolveCity(docket.to_city, docket.to_city_name),
    consignor_city_name: resolveCity(docket.consignor_city, docket.consignor_city_name),
    consignee_city_name: resolveCity(docket.consignee_city, docket.consignee_city_name),
    origin_office_name: resolveBranch(docket.origin_office, docket.origin_office_name),
    destination_branch_name: resolveBranch(docket.destination_branch, docket.destination_branch_name),
  };

  // Select the view based on version
  const renderView = () => {
    switch (version) {
      case "v1": return <DocketViewV1 docket={enrichedDocket} membership={activeMembership} />;
      case "v2": return <DocketViewV2 docket={enrichedDocket} membership={activeMembership} />;
      case "v3": return <DocketViewV3 docket={enrichedDocket} />;
      case "v4": return <DocketViewV4 docket={enrichedDocket} />;
      case "v5": return <DocketViewV5 docket={enrichedDocket} />;
      case "v6": return <DocketViewV6 docket={enrichedDocket} />;
      case "v7": return <DocketViewV7 docket={enrichedDocket} />;
      case "v8": return <DocketViewV8 docket={enrichedDocket} />;
      case "v9": return <DocketViewV9 docket={enrichedDocket} />;
      case "v10": return <DocketViewV10 docket={enrichedDocket} />;
      default: return <DocketViewV1 docket={enrichedDocket} membership={activeMembership} />;
    }
  };
  const getPageStyle = () => {
    switch (version) {
        case "v3": return "@page { size: 210mm 99mm; margin: 0; }";
        case "v4": return "@page { size: 115mm 148.5mm; margin: 0; }";
        case "v5": return "@page { size: 80mm auto; margin: 0; }";
        case "v6": return "@page { size: 210mm 148.5mm; margin: 0; }";
        case "v7": return "@page { size: 100mm 150mm; margin: 0; }";
        case "v8": return "@page { size: A4; margin: 10mm; }";
        case "v9": return "@page { size: A4; margin: 5mm; }";
        case "v10": return "@page { size: A4; margin: 10mm; }";
        default: return "@page { size: A4; margin: 10mm; }";
    }
  }

  return (
    <div className="relative font-sans text-zinc-950">
      <style>{getPageStyle()}</style>
      <div className="print:hidden fixed top-4 left-4 z-50 flex gap-1.5 bg-white/80 backdrop-blur-md p-1.5 rounded-md border-none shadow-xl overflow-x-auto max-w-[95vw]">
        {Array.from({ length: 10 }).map((_, i) => {
          const v = `v${i + 1}`;
          return (
            <button
              key={v}
              onClick={() => router.push(`/dockets/${id}/print?v=${v}`)}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                version === v 
                  ? "bg-zinc-950 text-white shadow-lg shadow-zinc-200 scale-105" 
                  : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {v.toUpperCase()}
            </button>
          );
        })}
      </div>
      <div className="print:m-0 min-h-screen bg-zinc-50/30 print:bg-transparent py-12 print:py-0">
        {renderView()}
      </div>
    </div>
  );
}

/**
 * SHARED COMPONENTS & UTILS
 */
const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <span className={`px-2 py-0.5 rounded-md text-sm font-bold uppercase tracking-wider ${className}`}>
        {children}
    </span>
);

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <p className={`text-sm font-semibold text-zinc-400 uppercase tracking-tight mb-0.5 ${className}`}>
        {children}
    </p>
);

/**
 * V1: PREMIUM STANDARD (A4)
 */
function DocketViewV1({ docket, membership }: DocketMembershipViewProps) {
  const total = num(docket.total_amount);
  const additional = num(docket.additional_charges);
  const delivery = num(docket.delivery_charge);
  const subtotal = total - additional - delivery;
  const companyName = docket.company_name || membership?.company_name || "METRO LOGISTICS";

  return (
    <div className="p-10 max-w-[800px] mx-auto bg-white shadow-2xl print:shadow-none print:p-0 rounded-md print:rounded-none">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-zinc-950 rounded-md flex items-center justify-center text-white font-black text-sm italic">M</div>
            <h1 className="text-sm font-black uppercase tracking-tight">{companyName}</h1>
          </div>
          <p className="text-zinc-500 text-sm font-medium">{docket.origin_office_name || membership?.branch_name}</p>
        </div>
        <div className="text-right">
          <Badge className="bg-zinc-100 text-zinc-900 mb-2">Docket Invoice</Badge>
          <p className="font-black text-sm tracking-tighter">#{fmtNo(docket.docket_no)}</p>
          <p className="text-zinc-500 text-sm font-medium">{new Date(docket.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-10">
        <div>
          <Label>Sender</Label>
          <p className="font-bold text-sm mb-1 leading-tight">{docket.consignor_name}</p>
          <p className="text-zinc-500 text-sm leading-relaxed">{docket.consignor_address}</p>
          <p className="text-zinc-900 text-sm font-bold mt-1">{docket.consignor_city_name}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-zinc-400 font-bold">M:</span>
            <span className="font-semibold text-zinc-900">{docket.consignor_phone}</span>
          </div>
        </div>
        <div>
          <Label>Receiver</Label>
          <p className="font-bold text-sm mb-1 leading-tight">{docket.consignee_name}</p>
          <p className="text-zinc-500 text-sm leading-relaxed">{docket.consignee_address}</p>
          <p className="text-zinc-900 text-sm font-bold mt-1">{docket.consignee_city_name}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-zinc-400 font-bold">M:</span>
            <span className="font-semibold text-zinc-900">{docket.consignee_phone}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
            { label: 'Destination', value: docket.to_city_name },
            { label: 'Mode', value: docket.mode },
            { label: 'Payment', value: docket.payment_type },
            { label: 'Delivery', value: docket.delivery_type }
        ].map((item, i) => (
            <div key={i} className="bg-zinc-50 p-3 rounded-md border-none">
                <Label className="mb-1">{item.label}</Label>
                <p className="font-bold text-zinc-900 uppercase text-sm">{item.value}</p>
            </div>
        ))}
      </div>

      <div className="border-none rounded-md overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50/50 text-left border-none">
              <th className="px-4 py-3 font-bold text-zinc-400 uppercase text-sm">Description</th>
              <th className="px-4 py-3 font-bold text-zinc-400 uppercase text-sm text-center">Package</th>
              <th className="px-4 py-3 font-bold text-zinc-400 uppercase text-sm text-center">Qty</th>
              <th className="px-4 py-3 font-bold text-zinc-400 uppercase text-sm text-right">Weight</th>
              <th className="px-4 py-3 font-bold text-zinc-400 uppercase text-sm text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="">
            {docket.line_items?.map((item: DocketLineItem, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-zinc-50/30" : ""}>
                <td className="px-4 py-3">
                    <p className="font-bold text-zinc-900">{item.item_type}</p>
                </td>
                <td className="px-4 py-3 text-center text-zinc-500">{item.package_type}</td>
                <td className="px-4 py-3 text-center font-bold">{item.pieces}</td>
                <td className="px-4 py-3 text-right">
                    <span className="font-bold">{item.charged_weight}</span> <span className="text-sm text-zinc-400">KG</span>
                </td>
                <td className="px-4 py-3 text-right font-black">₹{num(item.charge).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-16">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 font-medium">Subtotal</span>
            <span className="font-bold text-zinc-900">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 font-medium">Surcharges</span>
            <span className="font-bold text-zinc-900">₹{additional.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 font-medium">Delivery</span>
            <span className="font-bold text-zinc-900">₹{delivery.toFixed(2)}</span>
          </div>
          <div className="pt-3 border-none">
            <div className="flex justify-between items-center bg-zinc-950 text-white p-4 rounded-md shadow-xl shadow-zinc-200">
                <span className="text-sm font-black uppercase tracking-widest opacity-60">Total Amount</span>
                <span className="font-black text-sm">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-16 text-center">
        <div>
          <div className="h-16 border-none mb-2 mx-12"></div>
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Customer Signature</p>
        </div>
        <div>
          <div className="h-16 border-none mb-2 mx-12"></div>
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Authorized Signatory</p>
        </div>
      </div>
      
      <div className="mt-12 text-sm text-zinc-300 text-center font-medium">
        System Generated Document • {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

/**
 * V2: MODERN DARK ACCENT (A4)
 */
function DocketViewV2({ docket, membership }: DocketMembershipViewProps) {
    const total = num(docket.total_amount);
    const companyName = docket.company_name || membership?.company_name || "METRO LOGISTICS";

    return (
      <div className="p-0 max-w-[850px] mx-auto bg-white shadow-2xl print:shadow-none print:p-0 overflow-hidden rounded-md print:rounded-none">
        <div className="bg-zinc-950 text-white p-12 flex justify-between items-end">
            <div>
                <h1 className="text-sm font-black tracking-tighter uppercase mb-2 italic">{companyName}</h1>
                <p className="text-zinc-400 font-medium text-sm">{docket.origin_office_name || membership?.branch_name}</p>
            </div>
            <div className="text-right">
                <p className="text-zinc-400 text-sm font-black uppercase tracking-widest mb-1">Docket Number</p>
                <p className="text-sm font-black tracking-tighter font-mono">{fmtNo(docket.docket_no)}</p>
            </div>
        </div>

        <div className="p-12">
            <div className="grid grid-cols-3 gap-12 mb-12">
                <div className="col-span-2 grid grid-cols-2 gap-8 border-none">
                    <div>
                        <Label>Ship From</Label>
                        <p className="font-bold text-sm leading-tight">{docket.consignor_name}</p>
                        <p className="text-zinc-500 text-sm">{docket.consignor_city_name}</p>
                    </div>
                    <div>
                        <Label>Ship To</Label>
                        <p className="font-bold text-sm leading-tight">{docket.consignee_name}</p>
                        <p className="text-zinc-500 text-sm">{docket.consignee_city_name}</p>
                    </div>
                </div>
                <div>
                    <Label>Booking Details</Label>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400 font-medium">Date</span>
                            <span className="font-bold">{new Date(docket.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400 font-medium">Status</span>
                            <span className="font-black text-sm uppercase text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">{docket.status}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-50 rounded-md p-6 mb-12 grid grid-cols-4 gap-6 border-none">
                {[
                    { l: 'Mode', v: docket.mode },
                    { l: 'Type', v: docket.delivery_type },
                    { l: 'Payment', v: docket.payment_type },
                    { l: 'GST No', v: docket.gst_number || 'N/A' }
                ].map((x, i) => (
                    <div key={i}>
                        <Label>{x.l}</Label>
                        <p className="font-black text-sm uppercase text-zinc-900">{x.v}</p>
                    </div>
                ))}
            </div>

            <table className="w-full text-sm mb-12">
                <thead>
                    <tr className="text-left border-none">
                        <th className="pb-4 font-black text-sm uppercase">Description</th>
                        <th className="pb-4 text-center font-black text-sm uppercase">Qty</th>
                        <th className="pb-4 text-right font-black text-sm uppercase">Charge Wt</th>
                        <th className="pb-4 text-right font-black text-sm uppercase">Rate</th>
                        <th className="pb-4 text-right font-black text-sm uppercase">Line Total</th>
                    </tr>
                </thead>
                <tbody className="">
                    {docket.line_items?.map((item: DocketLineItem, idx: number) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-zinc-50/30" : ""}>
                            <td className="py-5">
                                <span className="font-bold text-zinc-900">{item.item_type}</span>
                                <span className="ml-2 text-zinc-400 text-sm">{item.package_type}</span>
                            </td>
                            <td className="py-5 text-center font-black">{item.pieces}</td>
                            <td className="py-5 text-right font-bold">{item.charged_weight} KG</td>
                            <td className="py-5 text-right text-zinc-500">₹{item.rate}</td>
                            <td className="py-5 text-right font-black text-sm">₹{num(item.charge).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex flex-col items-end">
                <div className="bg-zinc-950 text-white rounded-md p-8 w-80 shadow-2xl">
                    <div className="flex justify-between items-center mb-1 opacity-50 text-sm font-black uppercase tracking-widest">Net Payable</div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-sm font-black">₹{total.toFixed(2)}</span>
                        <span className="text-sm font-bold opacity-60">INC. TAXES</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
}

/**
 * V3: ULTRA COMPACT STRIP (210x99mm - A4/3)
 */
function DocketViewV3({ docket }: DocketViewProps) {
  const total = num(docket.total_amount);
  const companyName = docket.company_name || "METRO LOGISTICS";

  return (
    <div className="w-[210mm] h-[99mm] mx-auto bg-white text-zinc-900 font-sans p-4 overflow-hidden shadow-2xl print:shadow-none print:m-0 flex flex-col rounded-md print:rounded-none">
      <div className="flex justify-between items-center mb-3 pb-2 border-none">
        <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-950 rounded-md flex items-center justify-center text-white font-black text-sm italic">M</div>
            <h1 className="text-sm font-black uppercase tracking-tight">{companyName}</h1>
        </div>
        <div className="text-right">
            <p className="font-black text-sm tracking-tighter font-mono">#{fmtNo(docket.docket_no)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="bg-zinc-50 p-2 rounded-md border-none">
          <Label className="text-sm">Consignor</Label>
          <p className="font-bold text-sm truncate">{docket.consignor_name}</p>
          <p className="text-sm text-zinc-500 truncate">{docket.consignor_city_name} | {docket.consignor_phone}</p>
        </div>
        <div className="bg-zinc-50 p-2 rounded-md border-none">
          <Label className="text-sm">Consignee</Label>
          <p className="font-bold text-sm truncate">{docket.consignee_name}</p>
          <p className="text-sm text-zinc-500 truncate">{docket.consignee_city_name} | {docket.consignee_phone}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 mb-3 overflow-hidden border-none rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-none">
            <tr className="text-left font-black text-zinc-400 uppercase text-sm">
              <th className="px-2 py-1">Item</th>
              <th className="px-2 py-1 text-center">Qty</th>
              <th className="px-2 py-1 text-right">Weight</th>
              <th className="px-2 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="">
            {docket.line_items?.slice(0, 3).map((item: DocketLineItem, idx: number) => (
              <tr key={idx} className={`text-zinc-600 ${idx % 2 === 0 ? "bg-zinc-50/30" : ""}`}>
                <td className="px-2 py-1 font-bold text-zinc-900">{item.item_type}</td>
                <td className="px-2 py-1 text-center">{item.pieces}</td>
                <td className="px-2 py-1 text-right font-medium">{item.charged_weight}k</td>
                <td className="px-2 py-1 text-right font-black text-zinc-900">₹{num(item.charge).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-end pt-2 border-none">
        <div className="flex gap-4">
            <div>
                <Label className="text-sm">Destination</Label>
                <p className="text-sm font-black uppercase">{docket.to_city_name}</p>
            </div>
            <div>
                <Label className="text-sm">Mode</Label>
                <p className="text-sm font-black uppercase">{docket.mode}</p>
            </div>
        </div>
        <div className="bg-zinc-950 text-white px-4 py-2 rounded-md flex items-center gap-4">
            <span className="text-sm font-black opacity-50 uppercase tracking-widest">Total Payable</span>
            <span className="font-black text-sm leading-none">₹{total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * V4: QUARTER SHEET (115x148.5mm - A4/4)
 */
function DocketViewV4({ docket }: DocketViewProps) {
  const total = num(docket.total_amount);
  const companyName = docket.company_name || "METRO LOGISTICS";

  return (
    <div className="w-[115mm] h-[148.5mm] mx-auto bg-white text-zinc-900 font-sans p-6 overflow-hidden shadow-2xl print:shadow-none print:m-0 flex flex-col rounded-md print:rounded-none border-none">
      <div className="text-center mb-6">
        <div className="w-10 h-10 bg-zinc-950 rounded-md flex items-center justify-center text-white font-black text-sm italic mx-auto mb-2">M</div>
        <h1 className="text-sm font-black uppercase tracking-tight leading-none">{companyName}</h1>
        <Badge className="bg-zinc-100 text-zinc-900 mt-2 px-3 py-1">#{fmtNo(docket.docket_no)}</Badge>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border-none pl-3">
          <Label>Sender</Label>
          <p className="font-bold text-sm truncate">{docket.consignor_name}</p>
          <p className="text-sm text-zinc-500">{docket.consignor_phone}</p>
        </div>
        <div className="border-none pl-3">
          <Label>Receiver</Label>
          <p className="font-bold text-sm truncate">{docket.consignee_name}</p>
          <p className="text-sm text-zinc-500">{docket.consignee_phone}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 border-none py-4 mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="">
            {docket.line_items?.slice(0, 4).map((item: DocketLineItem, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-zinc-50/30" : ""}>
                <td className="py-1.5 pr-2 font-bold text-zinc-900">{item.item_type}</td>
                <td className="py-1.5 px-2 text-zinc-400">{item.pieces} qty</td>
                <td className="py-1.5 pl-2 text-right font-black">₹{num(item.charge).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-zinc-50 p-4 rounded-md">
        <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-black uppercase text-zinc-400">Net Payable</span>
            <span className="text-sm font-bold text-zinc-900">{docket.payment_type}</span>
        </div>
        <div className="text-sm font-black tracking-tighter">₹{total.toFixed(0)}</div>
      </div>
      
      <p className="text-sm text-center text-zinc-300 mt-4 uppercase font-bold tracking-widest italic">{docket.to_city_name} delivery</p>
    </div>
  );
}

/**
 * V5: THERMAL PREMIUM (80mm)
 */
function DocketViewV5({ docket }: DocketViewProps) {
  const total = num(docket.total_amount);
  const companyName = docket.company_name || "METRO LOGISTICS";

  return (
    <div className="w-[80mm] mx-auto bg-white text-zinc-950 font-sans p-6 print:p-2 overflow-hidden shadow-2xl print:shadow-none flex flex-col text-sm border-none">
      <div className="text-center mb-6 pb-6 border-none">
        <h1 className="text-sm font-black uppercase tracking-tighter italic mb-1">{companyName}</h1>
        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{docket.origin_office_name}</p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
            <span className="text-zinc-400 font-bold text-sm uppercase">Docket</span>
            <span className="font-black">#{fmtNo(docket.docket_no)}</span>
        </div>
        <div className="flex justify-between">
            <span className="text-zinc-400 font-bold text-sm uppercase">Date</span>
            <span className="font-bold">{new Date(docket.date).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
            <span className="text-zinc-400 font-bold text-sm uppercase">Route</span>
            <span className="font-black uppercase">{docket.consignor_city_name} ➟ {docket.to_city_name}</span>
        </div>
      </div>

      <div className="border-none py-4 mb-6 space-y-2">
        {docket.line_items?.map((item: DocketLineItem, idx: number) => (
          <div key={idx} className={`flex justify-between items-baseline p-1 ${idx % 2 === 0 ? "bg-zinc-50/30" : ""}`}>
            <div className="flex-1">
                <p className="font-bold text-sm uppercase">{item.item_type}</p>
                <p className="text-sm text-zinc-400 italic">{item.pieces} pkg • {item.charged_weight}kg</p>
            </div>
            <span className="font-black ml-4">₹{num(item.charge).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div className="bg-zinc-950 text-white p-5 rounded-md mb-8">
        <p className="text-sm font-black uppercase opacity-40 mb-1 tracking-widest">Total Amount Due</p>
        <div className="flex justify-between items-end">
            <span className="text-sm font-black">₹{total.toFixed(2)}</span>
            <Badge className="bg-white/10 text-white">{docket.payment_type}</Badge>
        </div>
      </div>

      <div className="text-center text-sm font-medium text-zinc-400">
        <p>Thank you for shipping with us.</p>
        <p className="mt-1 font-bold text-zinc-900 tracking-tighter">www.metrologistics.com</p>
      </div>
    </div>
  );
}

/**
 * V6: PREMIUM LANDSCAPE (A5 - 210x148.5mm)
 */
function DocketViewV6({ docket }: DocketViewProps) {
  const total = num(docket.total_amount);
  const companyName = docket.company_name || "METRO LOGISTICS";

  return (
    <div className="w-[210mm] h-[148.5mm] mx-auto bg-white text-zinc-900 font-sans p-10 overflow-hidden shadow-2xl print:shadow-none print:m-0 flex flex-col rounded-md print:rounded-none">
      <div className="flex justify-between items-start mb-10">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-950 rounded-md flex items-center justify-center text-white font-black text-sm italic">M</div>
            <div>
                <h1 className="text-sm font-black uppercase tracking-tighter leading-none">{companyName}</h1>
                <p className="text-sm font-bold text-zinc-400 mt-2 uppercase tracking-widest">{docket.origin_office_name}</p>
            </div>
        </div>
        <div className="text-right">
          <Badge className="bg-zinc-100 text-zinc-900 mb-2">Transport Receipt</Badge>
          <p className="text-sm font-black tracking-tighter font-mono leading-none">#{fmtNo(docket.docket_no)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-zinc-50 p-5 rounded-md border-none flex gap-4">
            <div className="w-8 h-8 rounded-md bg-white border-none flex items-center justify-center text-sm font-black">FROM</div>
            <div className="flex-1">
                <p className="font-black text-sm uppercase leading-tight mb-1">{docket.consignor_name}</p>
                <p className="text-zinc-500 text-sm truncate">{docket.consignor_address}</p>
            </div>
        </div>
        <div className="bg-zinc-50 p-5 rounded-md border-none flex gap-4">
            <div className="w-8 h-8 rounded-md bg-white border-none flex items-center justify-center text-sm font-black">TO</div>
            <div className="flex-1">
                <p className="font-black text-sm uppercase leading-tight mb-1">{docket.consignee_name}</p>
                <p className="text-zinc-500 text-sm truncate">{docket.consignee_address}</p>
            </div>
        </div>
      </div>

      <div className="flex-1 border-none rounded-md overflow-hidden mb-8">
          <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-400 font-black uppercase text-sm">
                  <tr>
                      <th className="px-5 py-3 text-left">Line Item Details</th>
                      <th className="px-5 py-3 text-center">Package</th>
                      <th className="px-5 py-3 text-center">Qty</th>
                      <th className="px-5 py-3 text-right">Weight</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
              </thead>
              <tbody className="">
                  {docket.line_items?.map((item: DocketLineItem, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-zinc-50/30" : ""}>
                          <td className="px-5 py-3 font-bold text-zinc-900">{item.item_type}</td>
                          <td className="px-5 py-3 text-center uppercase text-zinc-500">{item.package_type}</td>
                          <td className="px-5 py-3 text-center font-black">{item.pieces}</td>
                          <td className="px-5 py-3 text-right font-bold">{item.charged_weight} KG</td>
                          <td className="px-5 py-3 text-right font-black text-sm">₹{num(item.charge).toFixed(0)}</td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      <div className="flex justify-between items-center bg-zinc-950 text-white p-6 rounded-md shadow-xl shadow-zinc-200">
          <div className="flex gap-8">
              <div>
                  <p className="text-sm font-black uppercase opacity-40 mb-1 tracking-widest">Mode</p>
                  <p className="text-sm font-bold uppercase tracking-tight">{docket.mode}</p>
              </div>
              <div>
                  <p className="text-sm font-black uppercase opacity-40 mb-1 tracking-widest">Destination</p>
                  <p className="text-sm font-bold uppercase tracking-tight">{docket.to_city_name}</p>
              </div>
              <div>
                  <p className="text-sm font-black uppercase opacity-40 mb-1 tracking-widest">Payment</p>
                  <p className="text-sm font-bold uppercase tracking-tight">{docket.payment_type}</p>
              </div>
          </div>
          <div className="text-right">
              <p className="text-sm font-black uppercase opacity-40 mb-1 tracking-widest">Net Amount Payable</p>
              <p className="text-sm font-black tracking-tighter leading-none">₹{total.toFixed(0)}</p>
          </div>
      </div>
    </div>
  );
}

/**
 * V7: PREMIUM LOGISTICS LABEL (100x150mm - 4x6in)
 */
function DocketViewV7({ docket }: DocketViewProps) {
    const companyName = docket.company_name || "METRO LOGISTICS";
    const totalPieces = docket.line_items?.reduce((sum: number, item: DocketLineItem) => sum + (num(item.pieces) || 0), 0) || 0;

    return (
        <div className="w-[100mm] h-[150mm] mx-auto bg-white text-zinc-900 font-sans p-8 overflow-hidden shadow-2xl print:shadow-none print:m-0 flex flex-col rounded-md border-none">
            <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-zinc-950 rounded-md flex items-center justify-center text-white font-black text-sm italic">M</div>
                    <h1 className="text-sm font-black uppercase tracking-tight">{companyName}</h1>
                </div>
                <Badge className="bg-zinc-100 text-zinc-950">Shipment Label</Badge>
            </div>

            <div className="flex-1 space-y-8 flex flex-col justify-center">
                <div className="text-center">
                    <Label className="text-sm tracking-[0.2em]">Destination</Label>
                    <p className="text-sm font-black uppercase tracking-tighter leading-none">{docket.to_city_name}</p>
                </div>

                <div className="bg-zinc-50 p-6 rounded-md border-none text-center scale-110">
                    <Label className="text-sm">Total Packages</Label>
                    <p className="text-sm font-black leading-none">{totalPieces}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-none">
                    <div>
                        <Label>Docket No</Label>
                        <p className="text-sm font-black font-mono tracking-tight">#{fmtNo(docket.docket_no)}</p>
                    </div>
                    <div className="text-right">
                        <Label>Date</Label>
                        <p className="text-sm font-black tracking-tight">{new Date(docket.date).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="border-none pr-4">
                        <Label>From</Label>
                        <p className="text-sm font-bold leading-tight">{docket.consignor_name}</p>
                        <p className="text-sm text-zinc-500 mt-1">{docket.consignor_city_name}</p>
                    </div>
                    <div className="pl-4">
                        <Label>To</Label>
                        <p className="text-sm font-bold leading-tight">{docket.consignee_name}</p>
                        <p className="text-sm text-zinc-500 mt-1 font-bold">{docket.consignee_phone}</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-none text-center">
                 <p className="text-sm font-black tracking-[0.3em] text-zinc-300 uppercase italic">Metro Global Logistics Network</p>
            </div>
        </div>
    );
}

/**
 * V8: MINIMAL LUXURY (A4)
 */
function DocketViewV8({ docket }: DocketViewProps) {
    const total = num(docket.total_amount);
    const companyName = docket.company_name || "METRO LOGISTICS";

    return (
        <div className="p-20 max-w-[800px] mx-auto bg-white shadow-2xl print:shadow-none print:p-0 rounded-md print:rounded-none">
            <div className="flex flex-col items-center text-center mb-20">
                <div className="w-16 h-16 bg-zinc-950 rounded-md flex items-center justify-center text-white font-black text-sm italic mb-6 shadow-2xl shadow-zinc-200">M</div>
                <h1 className="text-sm font-black uppercase tracking-[0.2em] mb-4">{companyName}</h1>
                <div className="flex gap-4 items-center">
                    <span className="h-[1px] w-12 bg-zinc-100"></span>
                    <span className="text-zinc-400 font-bold uppercase tracking-widest text-sm">Official Freight Manifest</span>
                    <span className="h-[1px] w-12 bg-zinc-100"></span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-20 mb-20">
                <div className="space-y-8">
                    <div>
                        <Label className="tracking-widest opacity-50">Origin</Label>
                        <p className="text-sm font-black uppercase tracking-tight mb-2">{docket.consignor_city_name}</p>
                        <p className="text-zinc-400 font-medium">{docket.consignor_name}</p>
                    </div>
                    <div>
                        <Label className="tracking-widest opacity-50">Destination</Label>
                        <p className="text-sm font-black uppercase tracking-tight mb-2">{docket.to_city_name}</p>
                        <p className="text-zinc-400 font-medium">{docket.consignee_name}</p>
                    </div>
                </div>
                <div className="bg-zinc-50 rounded-md p-10 flex flex-col justify-between items-center text-center border-none">
                    <div>
                        <Label className="tracking-widest opacity-50">Reference ID</Label>
                        <p className="text-sm font-black font-mono tracking-tighter">#{fmtNo(docket.docket_no)}</p>
                    </div>
                    <div className="mt-8">
                        <Badge className="bg-zinc-950 text-white px-6 py-2 rounded-md">Booked • {new Date(docket.date).toLocaleDateString()}</Badge>
                    </div>
                </div>
            </div>

            <div className="mb-20">
                <Label className="mb-6 tracking-widest opacity-50">Itemized Manifest</Label>
                <div className="space-y-4">
                    {docket.line_items?.map((item: DocketLineItem, i: number) => (
                        <div key={i} className={`flex justify-between items-center py-6 border-none group hover:bg-zinc-50/50 transition-colors px-4 rounded-md ${i % 2 === 0 ? "bg-zinc-50/30" : ""}`}>
                            <div>
                                <p className="text-sm font-black text-zinc-900 mb-1">{item.item_type}</p>
                                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{item.pieces} UNITS • {item.package_type}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-zinc-950 leading-none mb-1">₹{num(item.charge).toLocaleString()}</p>
                                <p className="text-sm font-black text-zinc-300 uppercase tracking-widest">{item.charged_weight} KG WT</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between items-center pt-10 border-none">
                <div>
                    <Label className="tracking-widest opacity-50">Status</Label>
                    <p className="text-sm font-black uppercase tracking-tighter">Verified & Processed</p>
                </div>
                <div className="text-right">
                    <Label className="tracking-widest opacity-50 text-zinc-950">Net Investment</Label>
                    <p className="text-sm font-black tracking-tighter">₹{total.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

/**
 * V9: DATA-HEAVY MINIMAL (A4)
 */
function DocketViewV9({ docket }: DocketViewProps) {
    const total = num(docket.total_amount);
    const companyName = docket.company_name || "METRO LOGISTICS";

    return (
        <div className="p-8 max-w-[900px] mx-auto bg-white shadow-2xl print:shadow-none print:p-0 rounded-md border-none">
            <div className="grid grid-cols-4 gap-px bg-zinc-50 border-none rounded-md overflow-hidden mb-8">
                <div className="bg-white p-6 col-span-2">
                    <h1 className="text-sm font-black tracking-tighter mb-1">{companyName}</h1>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">{docket.origin_office_name}</p>
                </div>
                <div className="bg-zinc-50 p-6 flex flex-col justify-center">
                    <Label>Docket No</Label>
                    <p className="font-black font-mono text-sm">{fmtNo(docket.docket_no)}</p>
                </div>
                <div className="bg-zinc-50 p-6 flex flex-col justify-center">
                    <Label>Booking Date</Label>
                    <p className="font-black text-sm">{new Date(docket.date).toLocaleDateString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                {[
                    { title: 'Originator Details', name: docket.consignor_name, addr: docket.consignor_address, ph: docket.consignor_phone, city: docket.consignor_city_name },
                    { title: 'Recipient Details', name: docket.consignee_name, addr: docket.consignee_address, ph: docket.consignee_phone, city: docket.consignee_city_name }
                ].map((p, i) => (
                    <div key={i} className="bg-zinc-50/50 p-6 rounded-md border-none">
                        <Label className="mb-3">{p.title}</Label>
                        <p className="font-black text-sm uppercase mb-2">{p.name}</p>
                        <p className="text-zinc-500 text-sm leading-relaxed mb-4 h-12 overflow-hidden">{p.addr}</p>
                        <div className="flex justify-between items-center pt-4 border-none">
                            <span className="text-sm font-black text-zinc-900">{p.city}</span>
                            <span className="text-sm font-black text-zinc-400">PH: {p.ph}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-6 gap-4 mb-8">
                {[
                    { l: 'Mode', v: docket.mode },
                    { l: 'Basis', v: docket.basis },
                    { l: 'Payment', v: docket.payment_type },
                    { l: 'Dely Type', v: docket.delivery_type },
                    { l: 'Destination', v: docket.to_city_name },
                    { l: 'GST', v: docket.gst_number || 'N/A' }
                ].map((x, i) => (
                    <div key={i} className="border-none pb-2">
                        <Label>{x.l}</Label>
                        <p className="font-black text-sm uppercase truncate">{x.v}</p>
                    </div>
                ))}
            </div>

            <table className="w-full text-sm mb-8">
                <thead className="bg-zinc-950 text-white">
                    <tr>
                        <th className="p-3 text-left font-black uppercase tracking-widest text-sm">Description</th>
                        <th className="p-3 text-center font-black uppercase tracking-widest text-sm">Pkg</th>
                        <th className="p-3 text-center font-black uppercase tracking-widest text-sm">Qty</th>
                        <th className="p-3 text-right font-black uppercase tracking-widest text-sm">Act Wt</th>
                        <th className="p-3 text-right font-black uppercase tracking-widest text-sm">Chg Wt</th>
                        <th className="p-3 text-right font-black uppercase tracking-widest text-sm">Amount</th>
                    </tr>
                </thead>
                <tbody className="">
                    {docket.line_items?.map((item: DocketLineItem, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-zinc-50/30" : ""}>
                            <td className="p-4 font-bold">{item.item_type}</td>
                            <td className="p-4 text-center text-zinc-500">{item.package_type}</td>
                            <td className="p-4 text-center font-black">{item.pieces}</td>
                            <td className="p-4 text-right">{item.actual_weight}</td>
                            <td className="p-4 text-right font-bold">{item.charged_weight}</td>
                            <td className="p-4 text-right font-black text-sm">₹{num(item.charge).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-between items-start">
                <div className="bg-zinc-50 p-6 rounded-md border-none w-1/2">
                    <Label>Notes / Special Instructions</Label>
                    <p className="text-zinc-500 text-sm italic leading-relaxed">{docket.notes || "No additional notes provided for this shipment."}</p>
                </div>
                <div className="w-64 space-y-2 pt-2">
                    <div className="flex justify-between text-sm font-bold text-zinc-400">
                        <span>SUBTOTAL</span>
                        <span>₹{(total - num(docket.additional_charges) - num(docket.delivery_charge)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-zinc-400">
                        <span>OTHER CHARGES</span>
                        <span>₹{num(docket.additional_charges).toFixed(2)}</span>
                    </div>
                    <div className="pt-4 mt-4 border-none flex justify-between items-center">
                        <span className="font-black text-sm uppercase tracking-[0.2em]">Net Amount</span>
                        <span className="text-sm font-black tracking-tighter">₹{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * V10: MODERN DASHBOARD STYLE (A4)
 */
function DocketViewV10({ docket }: DocketViewProps) {
    const total = num(docket.total_amount);
    const companyName = docket.company_name || "METRO LOGISTICS";

    return (
        <div className="p-0 max-w-[900px] mx-auto bg-white shadow-2xl print:shadow-none print:p-0 rounded-md overflow-hidden">
            <div className="grid grid-cols-12">
                {/* Sidebar Accent */}
                <div className="col-span-1 bg-zinc-950 flex flex-col items-center py-12 gap-12">
                    <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center font-black italic text-zinc-950">M</div>
                    <div className="[writing-mode:vertical-lr] rotate-180 text-sm font-black uppercase tracking-[0.5em] text-zinc-500">Official Manifest</div>
                </div>

                {/* Main Content */}
                <div className="col-span-11 p-12">
                    <div className="flex justify-between items-start mb-16">
                        <div>
                            <p className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-2">Carrier</p>
                            <h1 className="text-sm font-black tracking-tighter uppercase">{companyName}</h1>
                            <p className="text-sm font-medium text-zinc-500 mt-1">{docket.origin_office_name}</p>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-zinc-100 text-zinc-900 mb-2">Docket ID</Badge>
                            <p className="text-sm font-black tracking-tighter font-mono leading-none">#{fmtNo(docket.docket_no)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-12 mb-16">
                        <div className="col-span-2 grid grid-cols-2 gap-8">
                            <div>
                                <Label>Consignor</Label>
                                <p className="font-bold text-sm mb-1 leading-tight">{docket.consignor_name}</p>
                                <p className="text-zinc-500 text-sm font-bold">{docket.consignor_city_name}</p>
                                <p className="text-zinc-400 text-sm mt-2">{docket.consignor_phone}</p>
                            </div>
                            <div>
                                <Label>Consignee</Label>
                                <p className="font-bold text-sm mb-1 leading-tight">{docket.consignee_name}</p>
                                <p className="text-zinc-500 text-sm font-bold">{docket.consignee_city_name}</p>
                                <p className="text-zinc-400 text-sm mt-2">{docket.consignee_phone}</p>
                            </div>
                        </div>
                        <div className="bg-zinc-50 p-6 rounded-md border-none flex flex-col justify-center gap-4">
                            <div className="flex justify-between items-center">
                                <Label className="mb-0">Destination</Label>
                                <span className="font-black text-sm uppercase">{docket.to_city_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <Label className="mb-0">Date</Label>
                                <span className="font-bold text-sm">{new Date(docket.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <Label className="mb-0">Mode</Label>
                                <Badge className="bg-zinc-950 text-white scale-75 origin-right">{docket.mode}</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mb-16">
                        <Label>Shipment Components</Label>
                        <div className="grid grid-cols-1 gap-3">
                            {docket.line_items?.map((item: DocketLineItem, i: number) => (
                                <div key={i} className={`flex items-center justify-between p-6 rounded-md border-none transition-colors ${i % 2 === 0 ? "bg-zinc-50/30" : "bg-zinc-50/10"}`}>
                                    <div className="flex items-center gap-6">
                                        <div className="w-10 h-10 bg-white rounded-md border-none flex items-center justify-center font-black text-zinc-950 shadow-sm">{item.pieces}</div>
                                        <div>
                                            <p className="font-bold text-sm uppercase text-zinc-900 leading-none mb-1">{item.item_type}</p>
                                            <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">{item.package_type} • {item.charged_weight}kg manifest wt</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-zinc-950 tracking-tighter">₹{num(item.charge).toFixed(0)}</p>
                                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Line Total</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div className="flex-1 max-w-md">
                            <Label>Terms & Conditions</Label>
                            <p className="text-sm text-zinc-400 italic leading-relaxed">By accepting this manifest, the carrier agrees to the terms of transport. Metro Logistics is not liable for indirect or consequential loss. All disputes are subject to arbitration.</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em] mb-2">Grand Total Payable</p>
                            <p className="text-sm font-black tracking-tighter leading-none">₹{total.toFixed(0)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
