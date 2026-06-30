"use client";

import { MasterTable, ColumnDef, FormFieldDef } from "@/components/master-table";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/page-container";

interface State {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  updated_at?: string;
}

const columns: ColumnDef<State>[] = [
  { 
    header: "Sr No.", 
    render: (_, __, index) => index + 1 
  },
  { header: "Name", accessorKey: "name" },
  { header: "Code", accessorKey: "code" },
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
  { name: "code", label: "Code", type: "text", required: true },
  { name: "is_active", label: "Active", type: "boolean" },
];

export default function StatesPage() {
  return (
    <PageContainer maxWidth="full">
      <MasterTable<State>
        title="States"
        apiPath="/api/v1/master/states/"
        columns={columns}
        formFields={formFields}
        searchPlaceholder="Search by name or code..."
      />
    </PageContainer>
  );
}
