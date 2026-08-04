import { useEffect, useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { SharedEventCard } from "@/components/events/SharedEventCard";
import type { SharedEventDto } from "@/lib/events/list-published-events";

function mapListApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby zobaczyć udostępnione wydarzenia.";
    case 503:
      return "Usługa nie jest skonfigurowana. Spróbuj ponownie później.";
    default:
      return "Nie udało się wczytać wydarzeń. Spróbuj ponownie.";
  }
}

export default function SharedEventsPage() {
  const [events, setEvents] = useState<SharedEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setServerError(null);

      try {
        const response = await fetch("/api/events/shared", {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setServerError(mapListApiError(response.status));
            setEvents([]);
          }
          return;
        }

        const data = (await response.json()) as { events: SharedEventDto[] };
        if (!cancelled) {
          setEvents(data.events);
        }
      } catch {
        if (!cancelled) {
          setServerError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Udostępnione wydarzenia</h1>
        <p className="mt-2 text-sm text-slate-500">Przeglądaj wydarzenia opublikowane przez innych rodziców.</p>
      </div>

      <ServerError message={serverError} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500" role="status">
          <span className="size-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
          Ładowanie wydarzeń…
        </div>
      ) : null}

      {!loading && !serverError && events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-8 text-center">
          <p className="text-sm text-slate-600">Brak udostępnionych wydarzeń od innych rodziców.</p>
        </div>
      ) : null}

      {!loading && events.length > 0 ? (
        <section className="space-y-3" aria-label="Lista udostępnionych wydarzeń">
          {events.map((event) => (
            <SharedEventCard key={event.id} event={event} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
