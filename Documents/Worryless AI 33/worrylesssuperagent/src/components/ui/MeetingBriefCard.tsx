import { FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Attendee {
  name: string;
  role?: string;
}

interface MeetingDocument {
  name: string;
  url: string;
}

interface Meeting {
  title: string;
  date: string;
  time: string;
  attendees: Attendee[];
  agenda: string[];
  documents?: MeetingDocument[];
}

interface MeetingBriefCardProps {
  meeting: Meeting;
}

export function MeetingBriefCard({ meeting }: MeetingBriefCardProps) {
  if (!meeting) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No meeting data available.
      </p>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-[20px] font-semibold leading-tight">
          {meeting.title}
        </CardTitle>
        <p className="text-[12px] text-muted-foreground">
          {meeting.date} &middot; {meeting.time}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attendees */}
        {meeting.attendees && meeting.attendees.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Attendees
            </h4>
            <ul className="space-y-1">
              {meeting.attendees.map((attendee, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className="font-medium">{attendee.name}</span>
                  {attendee.role && (
                    <span className="text-xs text-muted-foreground">
                      · {attendee.role}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agenda */}
        {meeting.agenda && meeting.agenda.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Agenda
            </h4>
            <ol className="list-decimal list-inside text-sm space-y-1">
              {meeting.agenda.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Documents */}
        {meeting.documents && meeting.documents.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Documents
            </h4>
            <ul className="space-y-1">
              {meeting.documents.map((doc, i) => (
                <li key={i}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {doc.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
