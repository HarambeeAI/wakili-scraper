interface PLRow {
  category: string;
  current: number;
  previous: number;
  change: number;
}

interface InlinePLTableProps {
  title?: string;
  rows: PLRow[];
  period?: string;
}

function formatCurrency(value: number): string {
  return `$${Math.abs(value).toLocaleString()}${value < 0 ? " (loss)" : ""}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

export function InlinePLTable({ title, rows, period }: InlinePLTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No P&L data available
      </p>
    );
  }

  return (
    <div className="w-full">
      {(title || period) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-base font-semibold">{title}</h3>
          )}
          {period && (
            <p className="text-xs text-muted-foreground">{period}</p>
          )}
        </div>
      )}
      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Current Period</th>
              <th className="px-3 py-2 text-right font-semibold">Previous Period</th>
              <th className="px-3 py-2 text-right font-semibold">Change (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isLast = i === rows.length - 1;
              const isNetIncome =
                row.category.toLowerCase().includes("net income") ||
                row.category.toLowerCase().includes("net profit");
              const changeColor =
                row.change >= 0 ? "text-green-600" : "text-red-600";

              return (
                <tr
                  key={i}
                  className={`border-b border-border last:border-0 ${
                    isLast || isNetIncome ? "border-t border-border" : ""
                  }`}
                >
                  <td
                    className={`px-3 py-2 ${
                      isLast || isNetIncome ? "font-bold" : ""
                    }`}
                  >
                    {row.category}
                  </td>
                  <td className={`px-3 py-2 text-right ${changeColor}`}>
                    {formatCurrency(row.current)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatCurrency(row.previous)}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${changeColor}`}>
                    {formatChange(row.change)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
