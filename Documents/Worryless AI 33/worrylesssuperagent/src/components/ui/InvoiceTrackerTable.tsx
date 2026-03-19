import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: string;
  due_date: string;
  invoice_number?: string;
}

interface InvoiceTrackerTableProps {
  invoices: Invoice[];
}

const STATUS_CLASSES: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  sent: "bg-amber-100 text-amber-700 border-amber-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
};

function getStatusClass(status: string): string {
  return STATUS_CLASSES[status.toLowerCase()] ?? "bg-muted text-muted-foreground";
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function InvoiceTrackerTable({ invoices }: InvoiceTrackerTableProps) {
  if (!invoices || invoices.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No invoices yet -- ask your agent to fetch or generate this.
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[280px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-semibold">Invoice #</th>
            <th className="px-3 py-2 text-left font-semibold">Client</th>
            <th className="px-3 py-2 text-right font-semibold">Amount</th>
            <th className="px-3 py-2 text-left font-semibold">Due Date</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-muted-foreground">
                {inv.invoice_number ?? inv.id}
              </td>
              <td className="px-3 py-2 font-medium">{inv.client}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(inv.amount)}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(inv.due_date)}</td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${getStatusClass(inv.status)}`}
                >
                  {inv.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
