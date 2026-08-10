import { useState } from "react";
import { Baby, FileText, MapPin, Trees, Type } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import type { LibraryEventDto } from "@/lib/events/list-own-events";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<LibraryEventDto["triage_status"], string> = {
  accepted: "Zaakceptowane",
  maybe: "Może później",
};

const LOCATION_KIND_OPTIONS: { value: "" | "indoor" | "outdoor"; label: string }[] = [
  { value: "", label: "Nieokreślone" },
  { value: "indoor", label: "W pomieszczeniu" },
  { value: "outdoor", label: "Na zewnątrz" },
];

const selectBase =
  "w-full rounded-lg border border-amber-200/80 bg-white px-3 py-2 pl-10 text-slate-900 focus:outline-none focus:ring-2 transition-colors";

const textareaBase =
  "w-full rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors";

interface EditFormState {
  title: string;
  summary: string;
  description: string;
  place: string;
  childAge: string;
  locationKind: "" | "indoor" | "outdoor";
}

interface FieldErrors {
  title?: string;
  summary?: string;
  description?: string;
  place?: string;
  childAge?: string;
}

interface EventCardProps {
  event: LibraryEventDto;
  onUpdated: (event: LibraryEventDto) => void;
  onDeleted: (eventId: string) => void;
}

function toFormState(event: LibraryEventDto): EditFormState {
  return {
    title: event.title,
    summary: event.summary ?? "",
    description: event.description ?? "",
    place: event.place ?? "",
    childAge: event.child_age_years === null ? "" : String(event.child_age_years),
    locationKind: event.location_kind ?? "",
  };
}

function mapPatchApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby zapisać zmiany.";
    case 400:
      return "Sprawdź wprowadzone dane.";
    case 404:
      return "Nie znaleziono wydarzenia.";
    case 503:
      return "Usługa nie jest skonfigurowana. Spróbuj ponownie później.";
    default:
      return "Nie udało się zapisać zmian. Spróbuj ponownie.";
  }
}

function mapDeleteApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby usunąć wydarzenie.";
    case 404:
      return "Nie znaleziono wydarzenia.";
    case 503:
      return "Usługa nie jest skonfigurowana. Spróbuj ponownie później.";
    default:
      return "Nie udało się usunąć wydarzenia. Spróbuj ponownie.";
  }
}

function mapPublishApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby opublikować wydarzenie.";
    case 404:
      return "Nie znaleziono wydarzenia.";
    case 409:
      return "To wydarzenie jest już opublikowane.";
    case 503:
      return "Usługa nie jest skonfigurowana. Spróbuj ponownie później.";
    default:
      return "Nie udało się opublikować wydarzenia. Spróbuj ponownie.";
  }
}

export function EventCard({ event, onUpdated, onDeleted }: EventCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [form, setForm] = useState<EditFormState>(() => toFormState(event));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [publishPending, setPublishPending] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const busy = savePending || deletePending || publishPending;
  const showImage = Boolean(event.imageUrl) && event.imageUrl !== failedImageUrl;

  function openEdit() {
    setForm(toFormState(event));
    setFieldErrors({});
    setActionError(null);
    setConfirmDelete(false);
    setConfirmPublish(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFieldErrors({});
    setActionError(null);
    setForm(toFormState(event));
  }

  function updateField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function buildPatchBody(): Record<string, unknown> | null {
    const nextErrors: FieldErrors = {};
    const title = form.title.trim();
    if (!title) {
      nextErrors.title = "Tytuł jest wymagany";
    } else if (title.length > 100) {
      nextErrors.title = "Tytuł może mieć max 100 znaków";
    }

    const summary = form.summary.trim();
    if (summary.length > 200) {
      nextErrors.summary = "Podsumowanie może mieć max 200 znaków";
    }

    const description = form.description.trim();
    if (description.length > 2000) {
      nextErrors.description = "Opis może mieć max 2000 znaków";
    }

    const place = form.place.trim();
    if (place.length > 200) {
      nextErrors.place = "Miejsce może mieć max 200 znaków";
    }

    let childAge: number | undefined;
    const childAgeRaw = form.childAge.trim();
    if (childAgeRaw) {
      const age = Number(childAgeRaw);
      if (!Number.isInteger(age) || age < 0 || age > 18) {
        nextErrors.childAge = "Podaj wiek od 0 do 18 lat";
      } else {
        childAge = age;
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !title) {
      return null;
    }

    const body: Record<string, unknown> = { title };

    if (summary) {
      body.summary = summary;
    }
    body.description = description.length > 0 ? description : null;
    if (place) {
      body.place = place;
    }
    if (childAge !== undefined) {
      body.childAge = childAge;
    }
    body.locationKind = form.locationKind === "" ? null : form.locationKind;

    return body;
  }

  async function handleSave() {
    const body = buildPatchBody();
    if (!body) {
      return;
    }

    setSavePending(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setActionError(mapPatchApiError(response.status));
        return;
      }

      const data = (await response.json()) as { event: LibraryEventDto };
      onUpdated(data.event);
      setEditing(false);
      setForm(toFormState(data.event));
    } catch {
      setActionError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
    } finally {
      setSavePending(false);
    }
  }

  async function handleDelete() {
    setDeletePending(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        setActionError(mapDeleteApiError(response.status));
        setConfirmDelete(false);
        return;
      }

      onDeleted(event.id);
    } catch {
      setActionError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      setConfirmDelete(false);
    } finally {
      setDeletePending(false);
    }
  }

  async function handlePublish() {
    setPublishPending(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/events/${event.id}/publish`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setActionError(mapPublishApiError(response.status));
        setConfirmPublish(false);
        return;
      }

      const data = (await response.json()) as { event: LibraryEventDto };
      onUpdated(data.event);
      setConfirmPublish(false);
    } catch {
      setActionError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      setConfirmPublish(false);
    } finally {
      setPublishPending(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
      {showImage ? (
        <img
          src={event.imageUrl ?? undefined}
          alt={event.title}
          loading="lazy"
          className="aspect-video w-full object-cover"
          onError={() => {
            setFailedImageUrl(event.imageUrl);
          }}
        />
      ) : null}
      <div className="p-4">
        {!editing ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {event.is_published ? (
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
                    Opublikowane
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    event.triage_status === "accepted"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900",
                  )}
                >
                  {STATUS_LABEL[event.triage_status]}
                </span>
              </div>
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

            <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-100 pt-4">
              {!confirmDelete && !confirmPublish ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={openEdit}
                    className={cn(
                      "rounded-lg bg-amber-600 text-white shadow-sm hover:bg-amber-700",
                      "focus-visible:ring-amber-400/50",
                    )}
                  >
                    Edytuj
                  </Button>
                  {!event.is_published ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setActionError(null);
                        setConfirmDelete(false);
                        setConfirmPublish(true);
                      }}
                      className="rounded-lg border-sky-200 text-sky-800 hover:bg-sky-50 hover:text-sky-900"
                    >
                      Opublikuj
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setActionError(null);
                      setConfirmPublish(false);
                      setConfirmDelete(true);
                    }}
                    className="rounded-lg border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Usuń
                  </Button>
                </>
              ) : null}

              {confirmPublish ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <p className="text-sm text-slate-600">Opublikować? Inni rodzice zobaczą to wydarzenie.</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void handlePublish();
                    }}
                    className={cn("rounded-lg bg-sky-600 text-white hover:bg-sky-700", "focus-visible:ring-sky-400/50")}
                  >
                    {publishPending ? "Publikowanie…" : "Tak"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setConfirmPublish(false);
                    }}
                    className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Nie
                  </Button>
                </div>
              ) : null}

              {confirmDelete ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <p className="text-sm text-slate-600">Na pewno usunąć?</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void handleDelete();
                    }}
                    className="rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    {deletePending ? "Usuwanie…" : "Tak"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setConfirmDelete(false);
                    }}
                    className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Nie
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <fieldset disabled={busy} className="min-w-0 space-y-3 border-0 p-0">
              <FormField
                id={`event-title-${event.id}`}
                label="Tytuł"
                value={form.title}
                onChange={(value) => {
                  updateField("title", value);
                }}
                error={fieldErrors.title}
                icon={<Type className="size-4" />}
              />

              <FormField
                id={`event-summary-${event.id}`}
                label="Podsumowanie"
                value={form.summary}
                onChange={(value) => {
                  updateField("summary", value);
                }}
                error={fieldErrors.summary}
                icon={<FileText className="size-4" />}
              />

              <div>
                <label
                  htmlFor={`event-description-${event.id}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Opis
                </label>
                <textarea
                  id={`event-description-${event.id}`}
                  rows={3}
                  value={form.description}
                  onChange={(e) => {
                    updateField("description", e.target.value);
                  }}
                  className={cn(
                    textareaBase,
                    fieldErrors.description ? "border-red-300 focus:ring-red-400/40" : "focus:ring-amber-400/50",
                  )}
                />
                {fieldErrors.description ? (
                  <p className="mt-1 text-xs text-red-700">{fieldErrors.description}</p>
                ) : null}
              </div>

              <FormField
                id={`event-place-${event.id}`}
                label="Miejsce"
                value={form.place}
                onChange={(value) => {
                  updateField("place", value);
                }}
                error={fieldErrors.place}
                icon={<MapPin className="size-4" />}
              />

              <FormField
                id={`event-child-age-${event.id}`}
                label="Wiek dziecka"
                type="number"
                value={form.childAge}
                onChange={(value) => {
                  updateField("childAge", value);
                }}
                error={fieldErrors.childAge}
                placeholder="0–18"
                icon={<Baby className="size-4" />}
              />

              <div>
                <label
                  htmlFor={`event-location-kind-${event.id}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Rodzaj lokalizacji
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400">
                    <Trees className="size-4" />
                  </span>
                  <select
                    id={`event-location-kind-${event.id}`}
                    value={form.locationKind}
                    onChange={(e) => {
                      updateField("locationKind", e.target.value as EditFormState["locationKind"]);
                    }}
                    className={cn(selectBase, "focus:ring-amber-400/50")}
                  >
                    {LOCATION_KIND_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-amber-100 pt-4">
                <Button
                  type="submit"
                  size="sm"
                  className={cn(
                    "rounded-lg bg-amber-600 text-white shadow-sm hover:bg-amber-700",
                    "focus-visible:ring-amber-400/50",
                  )}
                >
                  {savePending ? "Zapisywanie…" : "Zapisz"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                  className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Anuluj
                </Button>
              </div>
            </fieldset>
          </form>
        )}

        {actionError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
