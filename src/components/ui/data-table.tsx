import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface DataTableProps {
  headers: ReactNode[]
  rows: ReactNode[][]
  className?: string
}

/** Example: <DataTable headers={["Name"]} rows={[[item.name]]} /> */
export function DataTable({ headers, rows, className }: DataTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-surface-2 text-caption text-text-muted">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="h-9 border-b border-border px-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="h-9 px-3 text-text">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
