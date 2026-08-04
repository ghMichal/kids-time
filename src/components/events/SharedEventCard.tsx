import type { SharedEventDto } from "@/lib/events/list-published-events";

const LOCATION_KIND_LABEL: Record<"indoor" | "outdoor", string> = {
  indoor: "W pomieszczeniu",
  outdoor: "Na zewnątrz",
};

interface SharedEventCardProps {
  event: SharedEventDto;
}

export function SharedEventCard({ event }: SharedEventCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
          <span className="shrink-0 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
            Opublikowane
          </span>
        </div>

        {event.summary ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{event.summary}</p> : null}

        {event.place ? <p className="mt-2 text-sm text-slate-500">{event.place}</p> : null}

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
          {event.child_age_years !== null ? <span>Wiek: {event.child_age_years} lat</span> : null}
          {event.location_kind ? <span>{LOCATION_KIND_LABEL[event.location_kind]}</span> : null}
        </div>

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
