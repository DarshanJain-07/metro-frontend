"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { FormLabel, StyledInput } from "../new/_components/form-fields";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";

export function DocketsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(searchParams.get("from_date") || "");
  const [endDate, setEndDate] = useState(searchParams.get("to_date") || "");
  const [consignorName, setConsignorName] = useState(searchParams.get("consignor_name") || "");

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (startDate) params.set("from_date", startDate);
    else params.delete("from_date");
    
    if (endDate) params.set("to_date", endDate);
    else params.delete("to_date");
    
    if (consignorName) params.set("consignor_name", consignorName);
    else params.delete("consignor_name");
    
    params.set("page", "1");
    router.push(`/dockets?${params.toString()}`);
  };

  const handleClear = () => {
    setStartDate("");
    setEndDate("");
    setConsignorName("");
    router.push("/dockets");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0"
    >
      <div>
        <FormLabel>Start Date</FormLabel>
        <StyledInput
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      
      <div>
        <FormLabel>End Date</FormLabel>
        <StyledInput
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      
      <div className="lg:col-span-2">
        <FormLabel>Consignor Name</FormLabel>
        <Combobox
          value={consignorName}
          onValueChange={(val) => setConsignorName(val || "")}
        >
          <ComboboxInput 
            placeholder="Search consignor..." 
            className="compact-input"
            value={consignorName}
            onChange={(e) => setConsignorName(e.target.value)}
          />
          <ComboboxContent>
            <ComboboxList>
              {consignorName && (
                <ComboboxItem value={consignorName}>
                  Search for &quot;{consignorName}&quot;
                </ComboboxItem>
              )}
              <ComboboxItem value="Walk-in Customer">Walk-in Customer</ComboboxItem>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      
      <div className="flex gap-2 items-end">
        <Button 
          onClick={handleSearch} 
          className="h-8 flex-1 text-xs font-bold gap-2 active-press shadow-sm"
        >
          <Search className="h-3.5 w-3.5" /> Filter
        </Button>
        <Button 
          variant="outline" 
          onClick={handleClear} 
          className="h-8 text-xs px-3 active-press border-border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Clear Filters"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="lg:col-span-2 flex justify-end items-end">
        <Link href="/dockets/new" className="w-full md:w-auto">
          <Button className="w-full h-8 gap-2 text-xs font-bold active-press bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Docket
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
