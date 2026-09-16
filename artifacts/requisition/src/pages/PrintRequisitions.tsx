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

  /*
   * Parse one CSV line while correctly handling:
   *   - commas inside quoted values
   *   - escaped quotes ("")
   */
  const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current);

    return values;
  };

  /*
   * Escape values before writing them into the combined CSV.
   */
  const escapeCsvValue = (value: string): string => {
    if (
      value.includes('"') ||
      value.includes(",") ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  };

  /*
   * Extract only the ITEMS table from the CSV returned by
   * /api/requisitions/:id/print.
   *
   * Expected source structure:
   *
   * REQUISITION:
   * ...
   *
   * ITEMS:
   * Name,Description,Vessel,Qty,Units,Remark
   * ...
   */
  const extractItems = (csv: string): string[][] => {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  /*
   * Find the ITEMS section.
   *
   * Handles:
   *   ITEMS:
   *   ITEMS
   *   Items:
   */
  const itemsSectionIndex = lines.findIndex((line) => {
    const normalized = line
      .trim()
      .replace(/:$/, "")
      .trim()
      .toUpperCase();

    return normalized === "ITEMS";
  });

  if (itemsSectionIndex === -1) {
    console.error("ITEMS section not found in print CSV:", csv);
    return [];
  }

  /*
   * Find the actual item-table header after ITEMS.
   *
   * We look for the expected "Name" column instead of assuming
   * it is immediately on the next line.
   */
  let headerIndex = -1;

  for (
    let i = itemsSectionIndex + 1;
    i < lines.length;
    i++
  ) {
    if (!lines[i]?.trim()) {
      continue;
    }

    const headers = parseCsvLine(lines[i]).map((header) =>
      header.trim().toLowerCase(),
    );

    if (headers.includes("name")) {
      headerIndex = i;
      break;
    }

    /*
     * If another section starts before the item header,
     * there is no usable ITEMS table.
     */
    const normalizedLine = lines[i]
      .trim()
      .replace(/:$/, "")
      .trim()
      .toUpperCase();

    if (
      normalizedLine === "REQUISITION" ||
      normalizedLine === "ITEMS"
    ) {
      break;
    }
  }

  if (headerIndex === -1) {
    console.error(
      "ITEMS table header not found in print CSV:",
      csv,
    );
    return [];
  }

  const headers = parseCsvLine(lines[headerIndex]).map((header) =>
    header.trim().toLowerCase(),
  );

  const nameIndex = headers.indexOf("name");
  const descriptionIndex = headers.indexOf("description");
  const vesselIndex = headers.indexOf("vessel");
  const qtyIndex = headers.indexOf("qty");
  const unitsIndex = headers.indexOf("units");
  const remarkIndex = headers.indexOf("remark");

  if (nameIndex === -1) {
    return [];
  }

  const rows: string[][] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      continue;
    }

    const values = parseCsvLine(line);

    /*
     * Stop when another named CSV section begins.
     */
    const normalizedLine = line
      .trim()
      .replace(/:$/, "")
      .trim()
      .toUpperCase();

    if (
      normalizedLine === "REQUISITION" ||
      normalizedLine === "ITEMS"
    ) {
      break;
    }

    /*
     * Ignore malformed/empty rows.
     */
    if (!values.some((value) => value.trim() !== "")) {
      continue;
    }

    rows.push([
      values[nameIndex] ?? "",
      descriptionIndex >= 0
        ? values[descriptionIndex] ?? ""
        : "",
      vesselIndex >= 0
        ? values[vesselIndex] ?? ""
        : "",
      qtyIndex >= 0
        ? values[qtyIndex] ?? ""
        : "",
      unitsIndex >= 0
        ? values[unitsIndex] ?? ""
        : "",
      remarkIndex >= 0
        ? values[remarkIndex] ?? ""
        : "",
    ]);
  }

  console.log(
    `Extracted ${rows.length} items from print CSV`,
  );

  return rows;
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
      const ids = Array.from(selectedIds);

      /*
       * Fetch the existing individual print CSV for every
       * selected requisition.
       *
       * The existing backend endpoint continues to perform
       * all authorization checks.
       */
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(
            `/api/requisitions/${id}/print`,
            {
              method: "GET",
              credentials: "include",
            },
          );

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

          return extractItems(csv);
        }),
      );

      /*
       * Combine all item rows from all selected requisitions.
       */
      const allItems = results.flat();

      if (!allItems.length) {
        throw new Error(
          "No items were found in the selected requisitions.",
        );
      }

      /*
       * One single header for the entire CSV.
       */
      const header = [
        "Name",
        "Description",
        "Vessel",
        "Qty",
        "Units",
        "Remark",
      ];

      const csvRows = [
        header.map(escapeCsvValue).join(","),
        ...allItems.map((row) =>
          row.map(escapeCsvValue).join(","),
        ),
      ];

      /*
       * UTF-8 BOM helps Excel correctly recognize the CSV
       * encoding when opened directly.
       */
      const csvContent =
        "\uFEFF" + csvRows.join("\r\n");

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      link.href = url;
      link.download = `ReqFlow_Purchase_Items_${today}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: `${allItems.length} item${
          allItems.length === 1 ? "" : "s"
        } exported from ${ids.length} requisition${
          ids.length === 1 ? "" : "s"
        }.`,
      });

      setSelectedIds(new Set());
    } catch (error) {
      console.error(
        "Combined requisition item export failed:",
        error,
      );

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
            Select multiple in-progress requisitions and
            export all their items into one CSV.
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
                  Creating CSV...
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
                      {Array.from({ length: 8 }).map(
                        (_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ),
                      )}
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
                          Requisitions assigned to you will
                          appear here.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((req) => {
                    const isSelected =
                      selectedIds.has(req.id);

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
                          <PriorityBadge
                            priority={req.priority}
                          />
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
          {selectedIds.size === 1 ? "" : "s"} selected
          for export
        </p>
      )}
    </div>
  );
}