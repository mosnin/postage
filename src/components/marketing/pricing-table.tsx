import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type CellValue = boolean | string | number;

export interface PricingTableColumn {
  name: string;
  highlighted?: boolean;
}

export interface PricingTableRow {
  feature: string;
  values: CellValue[];
  /** Optional sub-label below the feature name */
  hint?: string;
}

export interface PricingTableSection {
  title: string;
  rows: PricingTableRow[];
}

interface PricingTableProps {
  columns: PricingTableColumn[];
  sections: PricingTableSection[];
  className?: string;
}

function Cell({ value, highlighted }: { value: CellValue; highlighted?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check
        className={cn(
          "mx-auto h-4 w-4",
          highlighted ? "text-primary" : "text-emerald-500"
        )}
        aria-label="Included"
      />
    ) : (
      <Minus
        className="mx-auto h-4 w-4 text-muted-foreground/40"
        aria-label="Not included"
      />
    );
  }
  return (
    <span
      className={cn(
        "text-sm font-medium",
        highlighted ? "text-primary" : "text-foreground"
      )}
    >
      {value}
    </span>
  );
}

export function PricingTable({ columns, sections, className }: PricingTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr>
            <th className="py-3 pr-4 text-left font-medium text-muted-foreground w-2/5">
              Feature
            </th>
            {columns.map((col) => (
              <th
                key={col.name}
                className={cn(
                  "px-4 py-3 text-center font-semibold",
                  col.highlighted && "text-primary"
                )}
              >
                <span className="relative inline-flex items-center gap-1.5">
                  {col.name}
                  {col.highlighted && (
                    <Badge className="text-xs rounded-full px-2 py-0" variant="default">
                      Popular
                    </Badge>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sections.map((section) => (
            <>
              {/* Section header */}
              <tr key={`section-${section.title}`}>
                <td
                  colSpan={columns.length + 1}
                  className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {section.title}
                </td>
              </tr>

              {/* Rows */}
              {section.rows.map((row, ri) => (
                <tr
                  key={`${section.title}-${ri}`}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium text-foreground">
                      {row.feature}
                    </span>
                    {row.hint && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.hint})
                      </span>
                    )}
                  </td>
                  {row.values.map((val, vi) => (
                    <td
                      key={vi}
                      className={cn(
                        "px-4 py-3 text-center",
                        columns[vi]?.highlighted && "bg-primary/5"
                      )}
                    >
                      <Cell value={val} highlighted={columns[vi]?.highlighted} />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
