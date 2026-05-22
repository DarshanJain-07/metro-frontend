import { Metadata } from "next";
import { NewDocketClient } from "./_components/new-docket-client";

export const metadata: Metadata = {
  title: "New Docket | Metro Logistics",
  description: "Create a new shipment docket",
};

export default async function NewDocketPage() {
  // Artificial delay to show the loading state (skeletons)
  await new Promise(resolve => setTimeout(resolve, 1500));
  return <NewDocketClient />;
}
