import type { LibraryEventDto } from "@/lib/events/list-own-events";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<LibraryEventDto["triage_status"], string> = {
  accepted: "Zaakceptowane",
  maybe: "Może później",
};

interface EventCardProps {
  event: LibraryEventDto;
}

export function EventCard({ event }: EventCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
              event.triage_status === "accepted" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900",
            )}
          >
            {STATUS_LABEL[event.triage_status]}
          </span>
        </div>

        {event.summary ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{event.summary}</p> : null}

        {event.place ? <p className="mt-2 text-sm text-slate-500">{event.place}</p> : null}

        {event.source_url ? (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-amber-800 hover:text-amber-950 hover:underline"
          >
            Zobacz źródło
          </a>
        ) : null}
      </div>
    </article>
  );
}
