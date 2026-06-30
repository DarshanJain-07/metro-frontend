"use client";

import { MasterTable, ColumnDef, FormFieldDef } from "@/components/master-table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { PageContainer } from "@/components/page-container";

interface Party {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  city: string;
  city_name: string;
  state_code: string;
  gst_number: string | null;
  is_active: boolean;
  updated_at?: string;
}

const columns: ColumnDef<Party>[] = [
  { 
    header: "Sr No.", 
    render: (_, __, index) => index + 1 
  },
  { header: "Name", accessorKey: "name" },
  { header: "Phone", accessorKey: "phone" },
  { header: "Address", accessorKey: "address", width: "250px" },
  { header: "City", accessorKey: "city_name" },
  { header: "GST", accessorKey: "gst_number" },
  { 
    header: "Active", 
    accessorKey: "is_active",
    render: (val) => (
      <Badge variant={val ? "success" : "error"} className="text-sm font-bold uppercase">
        {val ? "Active" : "Inactive"}
      </Badge>
    )
  },
];

const formFields: FormFieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "phone", label: "Phone", type: "text", required: true },
  { name: "address", label: "Address", type: "textarea" },
  { name: "city", label: "City", type: "select", optionsPath: "/api/v1/master/cities/", required: true },
  { name: "gst_number", label: "GST Number", type: "text" },
  { name: "is_active", label: "Active", type: "boolean" },
];

export default function PartiesPage() {
  const { can } = useAuth();
  const canCreate = can("master:create");
  const canEdit = can("master:edit");

  return (
    <PageContainer maxWidth="full">
      <MasterTable<Party>
        title="Parties"
        apiPath="/api/v1/master/parties/"
        columns={columns}
        formFields={formFields}
        searchPlaceholder="Search by name, phone or GST..."
        canAdd={canCreate}
        canEdit={canEdit}
      />
    </PageContainer>
  );
}
