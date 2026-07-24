import { useEffect, useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { EventCard } from "@/components/events/EventCard";
import type { LibraryEventDto } from "@/lib/events/list-own-events";

function mapListApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby zobaczyć swoje wydarzenia.";
    case 503:
      return "Usługa nie jest skonfigurowana. Spróbuj ponownie później.";
    default:
      return "Nie udało się wczytać wydarzeń. Spróbuj ponownie.";
  }
}

export default function EventsLibraryPage() {
  const [events, setEvents] = useState<LibraryEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setServerError(null);

      try {
        const response = await fetch("/api/events", {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setServerError(mapListApiError(response.status));
            setEvents([]);
          }
          return;
        }

        const data = (await response.json()) as { events: LibraryEventDto[] };
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
        <h1 className="text-3xl font-bold text-slate-900">Moje wydarzenia</h1>
        <p className="mt-2 text-sm text-slate-500">Przeglądaj wydarzenia zapisane z propozycji AI.</p>
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
          <p className="text-sm text-slate-600">Nie masz jeszcze zapisanych wydarzeń.</p>
          <a
            href="/suggestions"
            className="mt-3 inline-block text-sm font-medium text-amber-800 hover:text-amber-950 hover:underline"
          >
            Przejdź do propozycji
          </a>
        </div>
      ) : null}

      {!loading && events.length > 0 ? (
        <section className="space-y-3" aria-label="Lista wydarzeń">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onUpdated={(updated) => {
                setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              }}
              onDeleted={(eventId) => {
                setEvents((prev) => prev.filter((item) => item.id !== eventId));
              }}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
