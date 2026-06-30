import { Metadata } from "next";
import { DocketFormActions, DocketFormClient } from "../_components/docket-form-client";

export const metadata: Metadata = {
  title: "Update Docket | Metro Logistics",
  description: "Update an existing shipment docket",
};

export default async function UpdateDocketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DocketFormClient docketId={id}>
      <DocketFormActions />
    </DocketFormClient>
  );
}
