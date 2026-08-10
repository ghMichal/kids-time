import { useId, useRef, useState } from "react";
import { Baby, FileText, ImagePlus, MapPin, Sparkles, Trees, Type } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import type { LibraryEventDto } from "@/lib/events/list-own-events";
import { EVENT_IMAGE_ALLOWED_MIME_TYPES, EVENT_IMAGE_MAX_BYTES } from "@/lib/storage/constants";
import { cn } from "@/lib/utils";

const LOCATION_KIND_OPTIONS: { value: "" | "indoor" | "outdoor"; label: string }[] = [
  { value: "", label: "Nieokreślone" },
  { value: "indoor", label: "W pomieszczeniu" },
  { value: "outdoor", label: "Na zewnątrz" },
];

const selectBase =
  "w-full rounded-lg border border-amber-200/80 bg-white px-3 py-2 pl-10 text-slate-900 focus:outline-none focus:ring-2 transition-colors";

const textareaBase =
  "w-full rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors";

const ALLOWED_MIME = new Set<string>(EVENT_IMAGE_ALLOWED_MIME_TYPES);

interface FormState {
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
  image?: string;
}

interface ManualEventFormProps {
  onCreated: (event: LibraryEventDto) => void;
  onReload: () => Promise<void>;
}

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  description: "",
  place: "",
  childAge: "",
  locationKind: "",
};

function mapSummaryApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby wygenerować podsumowanie.";
    case 400:
      return "Sprawdź wprowadzone dane przed generowaniem podsumowania.";
    case 502:
      return "Usługa AI jest chwilowo niedostępna. Możesz zapisać wydarzenie bez podsumowania.";
    case 503:
      return "Usługa AI nie jest skonfigurowana. Możesz zapisać wydarzenie bez podsumowania.";
    case 504:
      return "Przekroczono limit czasu oczekiwania. Możesz zapisać wydarzenie bez podsumowania.";
    default:
      return "Nie udało się wygenerować podsumowania. Możesz zapisać wydarzenie bez niego.";
  }
}

function mapCreateApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby dodać wydarzenie.";
    case 400:
      return "Sprawdź wprowadzone dane.";
    case 503:
      return "Usługa nie jest skonfigurowana. Spróbuj ponownie później.";
    default:
      return "Nie udało się zapisać wydarzenia. Spróbuj ponownie.";
  }
}

function mapUploadApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby dodać obraz.";
    case 400:
      return "Nieprawidłowy plik obrazu (dozwolone: JPEG, PNG, WebP, max 5 MB). Wydarzenie zostało zapisane bez obrazu.";
    case 404:
      return "Nie znaleziono wydarzenia do dodania obrazu.";
    case 503:
      return "Usługa nie jest skonfigurowana. Wydarzenie zostało zapisane bez obrazu.";
    default:
      return "Nie udało się przesłać obrazu. Wydarzenie zostało zapisane bez obrazu.";
  }
}

function validateImageFile(file: File | null): string | null {
  if (!file) {
    return null;
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return "Dozwolone formaty: JPEG, PNG, WebP.";
  }
  if (file.size > EVENT_IMAGE_MAX_BYTES) {
    return "Obraz może mieć maksymalnie 5 MB.";
  }
  return null;
}

export function ManualEventForm({ onCreated, onReload }: ManualEventFormProps) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [generatePending, setGeneratePending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const busy = generatePending || savePending;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setFieldErrors({});
    setGenerateError(null);
    setSaveError(null);
    setUploadWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function buildPayload(): {
    title: string;
    summary?: string | null;
    description?: string | null;
    place?: string | null;
    childAge?: number | null;
    locationKind?: "indoor" | "outdoor" | null;
  } | null {
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

    let childAge: number | null | undefined;
    const childAgeRaw = form.childAge.trim();
    if (childAgeRaw) {
      const age = Number(childAgeRaw);
      if (!Number.isInteger(age) || age < 0 || age > 18) {
        nextErrors.childAge = "Podaj wiek od 0 do 18 lat";
      } else {
        childAge = age;
      }
    }

    const imageError = validateImageFile(imageFile);
    if (imageError) {
      nextErrors.image = imageError;
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !title) {
      return null;
    }

    return {
      title,
      summary: summary.length > 0 ? summary : null,
      description: description.length > 0 ? description : null,
      place: place.length > 0 ? place : null,
      childAge: childAge === undefined ? null : childAge,
      locationKind: form.locationKind === "" ? null : form.locationKind,
    };
  }

  async function handleGenerate() {
    const title = form.title.trim();
    if (!title) {
      setFieldErrors((prev) => ({ ...prev, title: "Tytuł jest wymagany" }));
      return;
    }
    if (title.length > 100) {
      setFieldErrors((prev) => ({ ...prev, title: "Tytuł może mieć max 100 znaków" }));
      return;
    }

    const description = form.description.trim();
    if (description.length > 2000) {
      setFieldErrors((prev) => ({ ...prev, description: "Opis może mieć max 2000 znaków" }));
      return;
    }

    const place = form.place.trim();
    if (place.length > 200) {
      setFieldErrors((prev) => ({ ...prev, place: "Miejsce może mieć max 200 znaków" }));
      return;
    }

    let childAge: number | null = null;
    const childAgeRaw = form.childAge.trim();
    if (childAgeRaw) {
      const age = Number(childAgeRaw);
      if (!Number.isInteger(age) || age < 0 || age > 18) {
        setFieldErrors((prev) => ({ ...prev, childAge: "Podaj wiek od 0 do 18 lat" }));
        return;
      }
      childAge = age;
    }

    setGeneratePending(true);
    setGenerateError(null);
    setSaveError(null);
    setUploadWarning(null);

    try {
      const response = await fetch("/api/ai/event-summary", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.length > 0 ? description : null,
          place: place.length > 0 ? place : null,
          childAge,
          locationKind: form.locationKind === "" ? null : form.locationKind,
        }),
      });

      if (!response.ok) {
        setGenerateError(mapSummaryApiError(response.status));
        return;
      }

      const data = (await response.json()) as { summary: string };
      setForm((prev) => ({ ...prev, summary: data.summary }));
      setFieldErrors((prev) => ({ ...prev, summary: undefined }));
    } catch {
      setGenerateError("Nie udało się połączyć z serwerem. Możesz zapisać wydarzenie bez podsumowania.");
    } finally {
      setGeneratePending(false);
    }
  }

  async function handleSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setSavePending(true);
    setSaveError(null);
    setUploadWarning(null);
    setGenerateError(null);

    try {
      const createResponse = await fetch("/api/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!createResponse.ok) {
        setSaveError(mapCreateApiError(createResponse.status));
        return;
      }

      const createData = (await createResponse.json()) as { event: LibraryEventDto };
      onCreated(createData.event);

      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);

        const uploadResponse = await fetch(`/api/events/${createData.event.id}/image`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!uploadResponse.ok) {
          setForm(EMPTY_FORM);
          setImageFile(null);
          setFieldErrors({});
          setGenerateError(null);
          setSaveError(null);
          setUploadWarning(mapUploadApiError(uploadResponse.status));
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return;
        }

        await onReload();
      }

      resetForm();
    } catch {
      setSaveError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
    } finally {
      setSavePending(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm"
      aria-labelledby={`${formId}-heading`}
    >
      <h2 id={`${formId}-heading`} className="text-lg font-semibold text-slate-900">
        Dodaj wydarzenie
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Wypełnij pola, opcjonalnie wygeneruj krótkie podsumowanie AI i dodaj jeden obraz.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          void handleSave(e);
        }}
        noValidate
      >
        <fieldset disabled={busy} className="min-w-0 space-y-3 border-0 p-0">
          <FormField
            id={`${formId}-title`}
            label="Tytuł"
            value={form.title}
            onChange={(value) => {
              updateField("title", value);
            }}
            error={fieldErrors.title}
            icon={<Type className="size-4" />}
          />

          <div>
            <label htmlFor={`${formId}-description`} className="mb-1 block text-sm font-medium text-slate-700">
              Opis
            </label>
            <textarea
              id={`${formId}-description`}
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
            {fieldErrors.description ? <p className="mt-1 text-xs text-red-700">{fieldErrors.description}</p> : null}
          </div>

          <FormField
            id={`${formId}-place`}
            label="Miejsce"
            value={form.place}
            onChange={(value) => {
              updateField("place", value);
            }}
            error={fieldErrors.place}
            icon={<MapPin className="size-4" />}
          />

          <FormField
            id={`${formId}-child-age`}
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
            <label htmlFor={`${formId}-location-kind`} className="mb-1 block text-sm font-medium text-slate-700">
              Rodzaj lokalizacji
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400">
                <Trees className="size-4" />
              </span>
              <select
                id={`${formId}-location-kind`}
                value={form.locationKind}
                onChange={(e) => {
                  updateField("locationKind", e.target.value as FormState["locationKind"]);
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

          <div className="space-y-2">
            <FormField
              id={`${formId}-summary`}
              label="Podsumowanie"
              value={form.summary}
              onChange={(value) => {
                updateField("summary", value);
              }}
              error={fieldErrors.summary}
              icon={<FileText className="size-4" />}
              hint={
                <p className="mt-1 text-xs text-slate-500">
                  Opcjonalne, max 200 znaków. Generowane z pól powyżej — możesz też wpisać ręcznie.
                </p>
              }
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void handleGenerate();
              }}
              className="rounded-lg border-amber-200 text-amber-900 hover:bg-amber-50"
            >
              {generatePending ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-700" />
                  Generuję podsumowanie…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="size-3.5" />
                  Generuj podsumowanie
                </span>
              )}
            </Button>
            <ServerError message={generateError} />
          </div>

          <div>
            <label htmlFor={`${formId}-image`} className="mb-1 block text-sm font-medium text-slate-700">
              Obraz (opcjonalnie)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400">
                <ImagePlus className="size-4" />
              </span>
              <input
                ref={fileInputRef}
                id={`${formId}-image`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null;
                  setImageFile(nextFile);
                  setFieldErrors((prev) => ({ ...prev, image: validateImageFile(nextFile) ?? undefined }));
                  setUploadWarning(null);
                }}
                className={cn(
                  "w-full rounded-lg border border-amber-200/80 bg-white py-2 pr-3 pl-10 text-sm text-slate-900",
                  "file:mr-3 file:rounded-md file:border-0 file:bg-amber-50 file:px-2 file:py-1 file:text-sm file:font-medium file:text-amber-900",
                  "focus:ring-2 focus:outline-none",
                  fieldErrors.image ? "border-red-300 focus:ring-red-400/40" : "focus:ring-amber-400/50",
                )}
              />
            </div>
            {fieldErrors.image ? <p className="mt-1 text-xs text-red-700">{fieldErrors.image}</p> : null}
            <p className="mt-1 text-xs text-slate-500">JPEG, PNG lub WebP, max 5 MB.</p>
          </div>
        </fieldset>

        <ServerError message={saveError} />
        {uploadWarning ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            {uploadWarning}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={busy}
          className={cn(
            "h-auto w-full rounded-xl bg-amber-600 px-4 py-2.5 text-base font-semibold text-white shadow-md",
            "hover:bg-amber-700",
          )}
        >
          {savePending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {imageFile ? "Zapisuję wydarzenie i obraz…" : "Zapisuję wydarzenie…"}
            </span>
          ) : (
            "Zapisz wydarzenie"
          )}
        </Button>
      </form>
    </section>
  );
}
