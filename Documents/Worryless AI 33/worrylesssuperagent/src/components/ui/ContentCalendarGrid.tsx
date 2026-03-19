import { Badge } from "@/components/ui/badge";

interface Post {
  id: string;
  title: string;
  platform: string;
  date: string;
  status: string;
}

interface ContentCalendarGridProps {
  posts: Post[];
  weekStart?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  twitter: "bg-blue-100 text-blue-700 border-blue-200",
  x: "bg-blue-100 text-blue-700 border-blue-200",
  linkedin: "bg-indigo-100 text-indigo-700 border-indigo-200",
  tiktok: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

function getPlatformClass(platform: string): string {
  return (
    PLATFORM_COLORS[platform.toLowerCase()] ??
    "bg-muted text-muted-foreground border-border"
  );
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  // getDay() returns 0=Sunday..6=Saturday; convert to 0=Mon..6=Sun
  return (d.getDay() + 6) % 7;
}

function getDateLabel(weekStart: string | undefined, dayIndex: number): string {
  if (!weekStart) return DAYS[dayIndex];
  try {
    const base = new Date(weekStart);
    base.setDate(base.getDate() + dayIndex);
    return base.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return DAYS[dayIndex];
  }
}

export function ContentCalendarGrid({ posts, weekStart }: ContentCalendarGridProps) {
  if (!posts || posts.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No scheduled posts. Ask your Marketer to create a content plan.
      </p>
    );
  }

  const byDay: Post[][] = Array.from({ length: 7 }, () => []);
  for (const post of posts) {
    const dayIdx = getDayOfWeek(post.date);
    if (dayIdx >= 0 && dayIdx < 7) {
      byDay[dayIdx].push(post);
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 min-w-[560px]">
        {DAYS.map((day, i) => (
          <div key={day} className="flex flex-col">
            <div className="text-[12px] font-semibold text-center py-1 border-b border-border mb-1">
              {getDateLabel(weekStart, i)}
            </div>
            <div className="min-h-[80px]">
              {byDay[i].map((post) => (
                <div
                  key={post.id}
                  className="text-xs p-1.5 rounded bg-card border mb-1"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 mb-0.5 ${getPlatformClass(post.platform)}`}
                  >
                    {post.platform}
                  </Badge>
                  <p className="truncate leading-tight">{post.title}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
