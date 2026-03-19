import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Deal {
  id: string;
  name: string;
  value: number;
  status: string;
  company?: string;
}

interface PipelineKanbanProps {
  deals: Deal[];
}

const COLUMNS = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"] as const;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function normalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function PipelineKanban({ deals }: PipelineKanbanProps) {
  if (!deals || deals.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No deals in pipeline. Ask your Sales Rep to generate leads.
      </p>
    );
  }

  const dealsByColumn: Record<string, Deal[]> = {};
  for (const col of COLUMNS) {
    dealsByColumn[col] = [];
  }
  for (const deal of deals) {
    const normalized = normalizeStatus(deal.status);
    if (normalized in dealsByColumn) {
      dealsByColumn[normalized].push(deal);
    } else {
      dealsByColumn["New"].push(deal);
    }
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 min-w-max pb-2">
        {COLUMNS.map((col) => {
          const colDeals = dealsByColumn[col];
          return (
            <div
              key={col}
              className="min-w-[160px] bg-muted/30 rounded-lg p-2"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">{col}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                  {colDeals.length}
                </span>
              </div>
              {colDeals.map((deal) => (
                <Card key={deal.id} className="p-2 mb-2">
                  <p className="text-[14px] font-semibold leading-tight truncate">
                    {deal.name}
                  </p>
                  {deal.company && (
                    <p className="text-[12px] text-muted-foreground truncate">
                      {deal.company}
                    </p>
                  )}
                  <p className="text-[12px] font-medium mt-1">
                    {formatCurrency(deal.value)}
                  </p>
                </Card>
              ))}
              {colDeals.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 text-center py-2">
                  Empty
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
