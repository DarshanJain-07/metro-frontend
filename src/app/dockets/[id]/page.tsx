import { Metadata } from "next";
import { NewDocketClient } from "../new/_components/new-docket-client";

export const metadata: Metadata = {
  title: "Update Docket | Metro Logistics",
  description: "Update an existing shipment docket",
};

interface UpdateDocketPageProps {
  params: Promise<{ id: string }>;
}

export default async function UpdateDocketPage({ params }: UpdateDocketPageProps) {
  const { id } = await params;
  
  // Artificial delay to show the loading state (skeletons)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return <NewDocketClient docketId={id} />;
}
