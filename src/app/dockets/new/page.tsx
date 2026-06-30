import { Metadata } from "next";
import { DocketFormActions, DocketFormClient } from "../_components/docket-form-client";

export const metadata: Metadata = {
  title: "New Docket | Metro Logistics",
  description: "Create a new shipment docket",
};

export default async function NewDocketPage() {
  return (
    <DocketFormClient>
      <DocketFormActions />
    </DocketFormClient>
  );
}
