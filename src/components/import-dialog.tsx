"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onImport: (file: File, format: "csv" | "xlsx") => Promise<void>;
}

function getImportFormat(file: File): "csv" | "xlsx" | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return "csv";
  if (extension === "xlsx" || extension === "xls") return "xlsx";
  return null;
}

export function ImportDialog({ isOpen, onOpenChange, title, onImport }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;

    if (!getImportFormat(selectedFile)) {
      toast.error("Please upload a CSV or XLSX file.");
      reset();
      return;
    }

    setFile(selectedFile);
  };

  const handleStartImport = async () => {
    if (!file) {
      toast.error("Please choose a file to import.");
      return;
    }

    const format = getImportFormat(file);
    if (!format) {
      toast.error("Please upload a CSV or XLSX file.");
      return;
    }

    setIsProcessing(true);
    try {
      await onImport(file, format);
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import file.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import {title}</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file. Headers must match the export template for this page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <button
            type="button"
            className={cn(
              "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-8 text-center transition-colors hover:bg-accent/50",
              file && "border-primary/60 bg-primary/5",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <Check className="mb-3 size-8 text-primary" />
            ) : (
              <Upload className="mb-3 size-8 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{file ? file.name : "Choose file"}</span>
            <span className="mt-1 text-sm text-muted-foreground">CSV or XLSX</span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
          </button>

          <Alert className="border-none bg-muted/50">
            <AlertCircle className="size-4 text-primary" />
            <AlertDescription className="text-sm font-medium">
              Imports are validated and saved transactionally by the backend.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStartImport} disabled={!file || isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
