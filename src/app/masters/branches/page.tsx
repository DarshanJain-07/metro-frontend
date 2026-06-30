"use client";

import { useState } from "react";
import { Building2, Filter } from "lucide-react";

import { MasterTable, ColumnDef, FormFieldDef } from "@/components/master-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { PageContainer } from "@/components/page-container";

interface Branch {
  id: string;
  owner_company_name: string | null;
  name: string;
  city: string;
  city_name: string;
  address: string | null;
  gst_number: string | null;
  is_active: boolean;
  updated_at?: string;
}

const columns: ColumnDef<Branch>[] = [
  { 
    header: "Sr No.", 
    render: (_, __, index) => index + 1 
  },
  { header: "Name", accessorKey: "name" },
  {
    header: "Owner Company",
    render: (_, branch) => branch.owner_company_name || "None",
  },
  { header: "City", accessorKey: "city_name" },
  {
    header: "Address",
    render: (_, branch) => branch.address || "-",
  },
  {
    header: "GST Number",
    render: (_, branch) => branch.gst_number || "-",
  },
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
  { name: "city", label: "City", type: "select", optionsPath: "/api/v1/master/cities/", required: true },
  { name: "address", label: "Address", type: "textarea" },
  { name: "gst_number", label: "GST Number", type: "text" },
  { name: "is_active", label: "Active", type: "boolean" },
];

export default function BranchesPage() {
  const { can } = useAuth();
  const canManage = can("*");
  const [ownCompanyOnly, setOwnCompanyOnly] = useState(false);

  return (
    <PageContainer maxWidth="full">
      <MasterTable<Branch>
        title="Branches"
        apiPath="/api/v1/master/offices/"
        queryParams={{ own_company_only: ownCompanyOnly }}
        columns={columns}
        formFields={formFields}
        canAdd={canManage}
        canEdit={canManage}
        searchPlaceholder="Search by name or city..."
        extraActions={
          <Button
            type="button"
            variant={ownCompanyOnly ? "default" : "outline"}
            size="sm"
            className="font-semibold shrink-0"
            onClick={() => setOwnCompanyOnly((current) => !current)}
          >
            {ownCompanyOnly ? (
              <Building2 className="h-4 w-4 mr-2" />
            ) : (
              <Filter className="h-4 w-4 mr-2" />
            )}
            Our company offices
          </Button>
        }
      />
    </PageContainer>
  );
}
