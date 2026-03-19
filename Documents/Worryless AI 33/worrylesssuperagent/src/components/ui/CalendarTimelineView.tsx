import { Badge } from "@/components/ui/badge";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type?: string;
  location?: string;
}

interface CalendarTimelineViewProps {
  events: CalendarEvent[];
  date?: string;
}

const TYPE_CLASSES: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-700 border-blue-200",
  focus: "bg-green-100 text-green-700 border-green-200",
  travel: "bg-amber-100 text-amber-700 border-amber-200",
};

function getTypeClass(type: string | undefined): string {
  if (!type) return "bg-muted text-muted-foreground border-border";
  return TYPE_CLASSES[type.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function sortByStart(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

export function CalendarTimelineView({ events, date }: CalendarTimelineViewProps) {
  if (!events || events.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No events scheduled for this day.
      </p>
    );
  }

  const sorted = sortByStart(events);

  return (
    <div className="w-full">
      {date && (
        <p className="text-xs font-semibold text-muted-foreground mb-3">
          {new Date(date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      <div>
        {sorted.map((event) => (
          <div
            key={event.id}
            className="flex gap-3 py-2 border-b border-border last:border-0"
          >
            <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
              {formatTime(event.start)}–{formatTime(event.end)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium leading-tight truncate">
                {event.title}
              </p>
              {event.location && (
                <p className="text-[12px] text-muted-foreground truncate">
                  {event.location}
                </p>
              )}
            </div>
            {event.type && (
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 self-start ${getTypeClass(event.type)}`}
              >
                {event.type}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
