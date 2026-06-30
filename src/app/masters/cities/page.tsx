"use client";

import { MasterTable, ColumnDef, FormFieldDef } from "@/components/master-table";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/page-container";

interface City {
  id: string;
  name: string;
  state: string;
  state_name: string;
  is_active: boolean;
  updated_at?: string;
}

const columns: ColumnDef<City>[] = [
  { 
    header: "Sr No.", 
    render: (_, __, index) => index + 1 
  },
  { header: "Name", accessorKey: "name" },
  { header: "State", accessorKey: "state_name" },
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
  { name: "state", label: "State", type: "select", optionsPath: "/api/v1/master/states/", required: true },
  { name: "is_active", label: "Active", type: "boolean" },
];

export default function CitiesPage() {
  return (
    <PageContainer maxWidth="full">
      <MasterTable<City>
        title="Cities"
        apiPath="/api/v1/master/cities/"
        columns={columns}
        formFields={formFields}
        searchPlaceholder="Search by name or state..."
      />
    </PageContainer>
  );
}
