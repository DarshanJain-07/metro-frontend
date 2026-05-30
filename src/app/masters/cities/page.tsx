"use client";

import { useEffect, useState } from "react";
import { MasterTable, ColumnDef, FormFieldDef } from "@/components/master-table";
import { fetchWithAuth } from "@/lib/api";

interface City {
  id: number;
  name: string;
  state: number;
  state_name: string;
  state_code: string;
  is_active: boolean;
}

const columns: ColumnDef<City>[] = [
  { header: "ID", accessorKey: "id" },
  { header: "Name", accessorKey: "name" },
  { header: "State", accessorKey: "state_name" },
  { header: "State Code", accessorKey: "state_code" },
  { 
    header: "Active", 
    accessorKey: "is_active",
    render: (val: boolean) => (
      <span className={`px-2 py-1 rounded-full text-xs ${val ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
        {val ? "Yes" : "No"}
      </span>
    )
  },
];

export default function CitiesPage() {
  const [stateOptions, setStateOptions] = useState<{label: string, value: number}[]>([]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await fetchWithAuth(`${apiUrl}/api/v1/states/`);
        if (res.ok) {
          const json = await res.json();
          const data = json.results || json;
          setStateOptions(data.map((s: any) => ({ label: s.name, value: s.id })));
        }
      } catch (err) {
        console.error("Failed to fetch states", err);
      }
    };
    fetchStates();
  }, [apiUrl]);

  const formFields: FormFieldDef[] = [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "state", label: "State", type: "select", options: stateOptions, required: true },
    { name: "is_active", label: "Active", type: "boolean" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <MasterTable<City>
        title="Cities"
        apiPath="/api/v1/cities/"
        columns={columns}
        formFields={formFields}
      />
    </div>
  );
}
