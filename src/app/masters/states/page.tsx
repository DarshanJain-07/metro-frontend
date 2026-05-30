"use client";

import { MasterTable, ColumnDef, FormFieldDef } from "@/components/master-table";

interface State {
  id: number;
  name: string;
  code: string;
}

const columns: ColumnDef<State>[] = [
  { header: "ID", accessorKey: "id" },
  { header: "Name", accessorKey: "name" },
  { header: "Code", accessorKey: "code" },
];

const formFields: FormFieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "code", label: "Code", type: "text", required: true },
];

export default function StatesPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <MasterTable<State>
        title="States"
        apiPath="/api/v1/states/"
        columns={columns}
        formFields={formFields}
      />
    </div>
  );
}
