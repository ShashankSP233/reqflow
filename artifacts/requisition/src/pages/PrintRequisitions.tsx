import { useState } from "react";
import { useListRequisitions } from "@workspace/api-client-react";
import { useRole } from "@/context/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/requisition/StatusBadge";
import { PriorityBadge } from "@/components/requisition/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import JSZip from "jszip";

export default function PrintRequisitions() {
  const { user } = useRole();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  /*
   * IMPORTANT:
   * This filter is specific to this page.
   *
   * We are NOT changing the normal RequisitionsList purchase_member
   * visibility behavior.
   *
   * This page intentionally shows only:
   *   status = in_progress
   *   assigned_to_id = current purchase member
   */
  const {
    data: requisitions,
    isLoading,
    refetch,
  } = useListRequisitions({
    status: "in_progress",
    assigned_to_id: user.id,
  });

  const allSelected =
    !!requisitions?.length &&
    requisitions.every((req) => selectedIds.has(req.id));

  const toggleSelection = (id: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!requisitions?.length) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (allSelected) {
        requisitions.forEach((req) => next.delete(req.id));
      } else {
        requisitions.forEach((req) => next.add(req.id));
      }

      return next;
    });
  };

  const extractFilename = (
    contentDisposition: string | null,
    fallback: string,
  ) => {
    if (!contentDisposition) {
      return fallback;
    }

    /*
     * Handles:
     *
     * Content-Disposition:
     * attachment; filename="REQ-001_Purchase_Requisition.csv"
     */
    const match = contentDisposition.match(/filename="([^"]+)"/i);

    if (match?.[1]) {
      return match[1];
    }

    return fallback;
  };

  const exportSelected = async () => {
    if (!selectedIds.size) {
      toast({
        title: "No requisitions selected",
        description: "Select at least one requisition to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const zip = new JSZip();

      const ids = Array.from(selectedIds);

      /*
       * Reuse the existing individual print endpoint.
       *
       * Every request therefore goes through the existing backend
       * permission checks:
       *
       *   - current user must be purchase_member
       *   - requisition must be in_progress
       *   - requisition must be assigned to current user
       */
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/requisitions/${id}/print`, {
            method: "GET",
            credentials: "include",
          });

          if (!response.ok) {
            let message = `Failed to export requisition ${id}.`;

            try {
              const errorData = await response.json();

              if (errorData?.error) {
                message = errorData.error;
              }
            } catch {
              // Ignore JSON parsing errors.
            }

            throw new Error(message);
          }

          const csv = await response.text();

          const fallbackReq = requisitions?.find(
            (req) => req.id === id,
          );

          const fallbackFilename = `${
            fallbackReq?.ref_number ?? `REQ-${id}`
          }_Purchase_Requisition.csv`;

          const filename = extractFilename(
            response.headers.get("content-disposition"),
            fallbackFilename,
          );

          return {
            filename,
            csv,
          };
        }),
      );

      /*
       * Add every CSV returned by the existing /print endpoint
       * into the ZIP.
       */
      for (const result of results) {
        zip.file(result.filename, result.csv);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6,
        },
      });

      /*
       * Trigger the browser download.
       */
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");

      const today = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `ReqFlow_Print_${today}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: `${results.length} requisition${
          results.length === 1 ? "" : "s"
        } exported successfully.`,
      });

      setSelectedIds(new Set());
    } catch (error) {
      console.error("Batch requisition export failed:", error);

      toast({
        title: "Export failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to export the selected requisitions.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  /*
   * This page is intended for purchase members only.
   * The navigation also hides it from other roles, but this prevents
   * accidental rendering if someone manually enters the URL.
   */
  if (user.role !== "purchase_member") {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You do not have permission to access this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Print Requisitions
            </h1>
          </div>

          <p className="text-muted-foreground text-sm mt-1">
            Select multiple in-progress requisitions and export them as
            individual CSV files in one ZIP.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading || isExporting}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                disabled={
                  !requisitions?.length ||
                  isLoading ||
                  isExporting
                }
                aria-label="Select all requisitions"
              />

              <div>
                <p className="text-sm font-medium">
                  Select Requisitions
                </p>

                <p className="text-xs text-muted-foreground">
                  {selectedIds.size} selected
                  {requisitions
                    ? ` · ${requisitions.length} available`
                    : ""}
                </p>
              </div>
            </div>

            <Button
              onClick={exportSelected}
              disabled={
                selectedIds.size === 0 ||
                isExporting ||
                isLoading
              }
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating ZIP...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Selected
                </>
              )}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Ref No.</TableHead>
                  <TableHead>Purpose / Requester</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    Est. Value (₹)
                  </TableHead>
                  <TableHead className="text-right">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 8 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !requisitions?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-40 text-center"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="w-8 h-8" />

                        <p className="text-sm font-medium">
                          No in-progress requisitions
                        </p>

                        <p className="text-xs">
                          Requisitions assigned to you will appear here.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((req) => {
                    const isSelected = selectedIds.has(req.id);

                    return (
                      <TableRow
                        key={req.id}
                        className={
                          isSelected
                            ? "bg-muted/50"
                            : "hover:bg-muted/30"
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleSelection(req.id)
                            }
                            disabled={isExporting}
                            aria-label={`Select ${req.ref_number}`}
                          />
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-sm font-semibold text-primary">
                            {req.ref_number}
                          </span>
                        </TableCell>

                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[220px]">
                            {req.purpose ?? "—"}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {req.raised_by_name}
                          </p>
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {req.site_name ?? "—"}
                        </TableCell>

                        <TableCell>
                          <PriorityBadge priority={req.priority} />
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={req.status} />
                        </TableCell>

                        <TableCell className="text-right text-sm">
                          ₹
                          {Number(
                            req.total_expected_cost ?? 0,
                          ).toLocaleString("en-IN")}
                        </TableCell>

                        <TableCell className="text-right text-muted-foreground text-xs">
                          {formatDate(req.requisition_date)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {selectedIds.size} requisition
          {selectedIds.size === 1 ? "" : "s"} selected for export
        </p>
      )}
    </div>
  );
}