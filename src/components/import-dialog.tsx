"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CompactSelect } from "@/components/ui/form-elements";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Upload, Check, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { FormFieldDef } from "./master-table";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  formFields: FormFieldDef[];
  dynamicOptions?: Record<string, { label: string; value: string | number }[]>;
  onImport: (data: ImportRow[]) => Promise<void>;
}

type ImportValue = string | number | boolean | null;
type ImportRow = Record<string, ImportValue>;

export function ImportDialog({ isOpen, onOpenChange, title, formFields, dynamicOptions = {}, onImport }: ImportDialogProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreviewData([]);
    setErrors({});
    setIsProcessing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length === 0) {
        toast.error("File is empty");
        return;
      }
      
      const parsedHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const parsedRows = lines.slice(1).map(line => 
        line.split(",").map(cell => cell.trim().replace(/^"|"$/g, ""))
      );

      setHeaders(parsedHeaders);
      setRows(parsedRows);
      
      // Auto-mapping logic
      const initialMapping: Record<string, string> = {};
      formFields.forEach(field => {
        const match = parsedHeaders.find(h => 
          h.toLowerCase() === field.label.toLowerCase() || 
          h.toLowerCase() === field.name.toLowerCase()
        );
        if (match) {
          initialMapping[field.name] = match;
        }
      });
      setMapping(initialMapping);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleMapChange = (fieldName: string, csvHeader: string) => {
    setMapping(prev => ({ ...prev, [fieldName]: csvHeader }));
    // Clear error for this field when changed
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateMapping = () => {
    const newErrors: Record<string, string> = {};
    formFields.forEach(field => {
      if (field.required && !mapping[field.name]) {
        newErrors[field.name] = `${field.label} is required and must be mapped.`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix mapping errors before proceeding");
      return false;
    }
    return true;
  };

  const generatePreview = () => {
    if (!validateMapping()) return;

    const unresolved = new Set<string>();
    const data = rows.slice(0, 5).map(row => {
      const item: ImportRow = {};
      formFields.forEach(field => {
        const csvHeader = mapping[field.name];
        if (csvHeader) {
          const headerIndex = headers.indexOf(csvHeader);
          const rawValue = row[headerIndex];
          let value: ImportValue = rawValue;
          
          if (field.type === "number") {
            value = Number(rawValue);
            if (isNaN(value as number)) unresolved.add(field.name);
          } else if (field.type === "boolean") {
            value = rawValue?.toLowerCase() === "true" || rawValue === "1" || rawValue?.toLowerCase() === "yes";
          } else if (field.type === "select") {
            const options = field.options || dynamicOptions[field.name] || [];
            const match = options.find(opt => 
              String(opt.label).toLowerCase() === String(rawValue).toLowerCase() || 
              String(opt.value).toLowerCase() === String(rawValue).toLowerCase()
            );
            if (match) {
              value = match.value;
            } else if (rawValue) {
              unresolved.add(field.name);
            }
          }
          
          item[field.name] = value;
          if (field.type === "select") {
            const options = field.options || dynamicOptions[field.name] || [];
            const match = options.find(opt => 
              String(opt.label).toLowerCase() === String(rawValue).toLowerCase() || 
              String(opt.value).toLowerCase() === String(rawValue).toLowerCase()
            );
            item[`_${field.name}_label`] = match ? match.label : (rawValue || "");
          } else {
            item[`_${field.name}_label`] = value;
          }
        }
      });
      return item;
    });

    if (unresolved.size > 0) {
      const fieldLabels = Array.from(unresolved).map(f => formFields.find(ff => ff.name === f)?.label);
      setErrors(prev => {
        const newErrors = { ...prev };
        unresolved.forEach(f => {
          newErrors[f] = `Some values in "${formFields.find(ff => ff.name === f)?.label}" could not be matched.`;
        });
        return newErrors;
      });
      toast.error(`Cannot proceed: Unmatched values found in [${fieldLabels.join(", ")}]. Please check your CSV data or mapping.`);
      return;
    }

    setPreviewData(data);
    setErrors({});
    setStep("preview");
  };

  const handleStartImport = async () => {
    setIsProcessing(true);
    try {
      const dataToImport = rows.map(row => {
        const item: ImportRow = {};
        formFields.forEach(field => {
          const csvHeader = mapping[field.name];
          if (csvHeader) {
            const headerIndex = headers.indexOf(csvHeader);
            const rawValue = row[headerIndex];
            let value: ImportValue = rawValue;
            
            if (field.type === "number") {
              value = Number(rawValue);
            } else if (field.type === "boolean") {
              value = rawValue?.toLowerCase() === "true" || rawValue === "1" || rawValue?.toLowerCase() === "yes";
            } else if (field.type === "select") {
              const options = field.options || dynamicOptions[field.name] || [];
              const match = options.find(opt => 
                String(opt.label).toLowerCase() === String(rawValue).toLowerCase() || 
                String(opt.value).toLowerCase() === String(rawValue).toLowerCase()
              );
              if (match) value = match.value;
            }
            
            item[field.name] = value;
          }
        });
        return item;
      });

      await onImport(dataToImport);
      onOpenChange(false);
      reset();
    } catch (err) {
      // Errors are handled by onImport in MasterTable
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) reset();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import {title}</DialogTitle>
          <DialogDescription>
            Upload a CSV file and map its columns to import data into the {title.toLowerCase()} master.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {step === "upload" && (
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-md p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-1">CSV files only</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileChange} 
              />
            </div>
          )}

          {step === "map" && (
            <div className="space-y-6">
              <Alert className="bg-muted/50 border-none">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm font-medium">
                  Map your CSV columns to the expected fields. Required fields are marked with *.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_24px_1fr] gap-4 px-2 text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">
                  <div>System Field</div>
                  <div />
                  <div>CSV Column</div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto px-2 pr-4">
                  {formFields.map(field => (
                    <div key={field.name} className="grid grid-cols-[1fr_24px_1fr] gap-4 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {field.label} 
                          {field.required && <span className="text-destructive font-bold">*</span>}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono opacity-70">
                          {field.name}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <div className="min-w-0">
                        <CompactSelect
                          value={mapping[field.name] || ""}
                          onValueChange={(val) => handleMapChange(field.name, val)}
                          options={headers.map(h => ({ label: h, value: h }))}
                          placeholder="Do not import"
                          className={cn(
                            "h-10 text-sm transition-all",
                            errors[field.name] ? "border-destructive ring-destructive/20" : "focus:ring-primary/20"
                          )}
                        />
                        {errors[field.name] && (
                          <p className="text-sm text-destructive mt-1 font-medium animate-in fade-in slide-in-from-top-1">
                            {errors[field.name]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <Alert className="bg-emerald-500/10 text-emerald-600 border-none">
                <Check className="h-4 w-4" />
                <AlertDescription className="text-sm font-semibold">
                  Mapping verified! Review the data preview below.
                </AlertDescription>
              </Alert>

              <div className="border rounded-md overflow-hidden bg-muted/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {formFields.filter(f => mapping[f.name]).map(f => (
                        <TableHead key={f.name} className="whitespace-nowrap">
                          {f.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-background/50">
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        {formFields.filter(f => mapping[f.name]).map(f => (
                          <TableCell key={f.name} className="max-w-[150px] truncate whitespace-nowrap font-medium">
                            {String(row[`_${f.name}_label`] ?? "-")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground font-medium italic text-center bg-muted/50 py-1.5 rounded-md">
                Showing first {previewData.length} of {rows.length} rows to be imported
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 pt-6 mt-4 sm:justify-between sm:items-center">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => step === "upload" ? onOpenChange(false) : setStep(step === "map" ? "upload" : "map")}
          >
            {step === "upload" ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-3">
            {step === "map" && (
              <Button 
                onClick={generatePreview} 
                size="lg"
              >
                Continue to Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === "preview" && (
              <Button 
                onClick={handleStartImport} 
                disabled={isProcessing}
                size="lg"
                variant="success"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Start {rows.length} Row Import
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
