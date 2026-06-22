import { useState } from "react";
import { Clock, MapPin, Search, Trees, User } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { Button } from "@/components/ui/button";
import type { SuggestionItem } from "@/lib/ai/suggestion-response.schema";
import type { SuggestionRequest } from "@/lib/ai/suggestion-request.schema";
import { cn } from "@/lib/utils";

type IndoorOutdoor = SuggestionRequest["indoorOutdoor"];

interface FormErrors {
  place?: string;
  time?: string;
  childAge?: string;
  indoorOutdoor?: string;
}

const INDOOR_OUTDOOR_OPTIONS: { value: IndoorOutdoor; label: string }[] = [
  { value: "indoor", label: "W pomieszczeniu" },
  { value: "outdoor", label: "Na zewnątrz" },
  { value: "either", label: "Obojętnie" },
];

const selectBase =
  "w-full rounded-lg border border-amber-200/80 bg-white px-3 py-2 pl-10 text-slate-900 focus:outline-none focus:ring-2 transition-colors";

function mapApiError(status: number): string {
  switch (status) {
    case 401:
      return "Musisz być zalogowany, aby uzyskać propozycje.";
    case 400:
      return "Sprawdź wprowadzone dane.";
    case 502:
      return "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie.";
    case 503:
      return "Usługa AI nie jest skonfigurowana.";
    case 504:
      return "Przekroczono limit czasu oczekiwania. Spróbuj ponownie.";
    default:
      return "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";
  }
}

function parseChildAge(value: string): { age?: number; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Wiek dziecka jest wymagany" };
  }

  const age = Number(trimmed);
  if (!Number.isInteger(age) || age < 0 || age > 18) {
    return { error: "Podaj wiek od 0 do 18 lat" };
  }

  return { age };
}

export default function SuggestionsPage() {
  const [place, setPlace] = useState("");
  const [time, setTime] = useState("");
  const [childAge, setChildAge] = useState("");
  const [indoorOutdoor, setIndoorOutdoor] = useState<IndoorOutdoor>("either");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  function clearError(field: keyof FormErrors) {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): SuggestionRequest | null {
    const next: FormErrors = {};

    if (!place.trim()) {
      next.place = "Miejsce jest wymagane";
    }
    if (!time.trim()) {
      next.time = "Czas jest wymagany";
    }

    const { age, error: childAgeError } = parseChildAge(childAge);
    if (childAgeError) {
      next.childAge = childAgeError;
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || age === undefined) {
      return null;
    }

    return {
      place: place.trim(),
      time: time.trim(),
      childAge: age,
      indoorOutdoor,
    };
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const payload = validate();
    if (!payload) {
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const response = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setServerError(mapApiError(response.status));
        return;
      }

      const data = (await response.json()) as { suggestions: SuggestionItem[] };
      setSuggestions(data.suggestions);
    } catch {
      setServerError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Propozycje</h1>
        <p className="mt-2 text-sm text-slate-500">Podaj kryteria, a AI zaproponuje aktywności dla dziecka.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormField
          id="place"
          label="Miejsce"
          value={place}
          onChange={(value) => {
            setPlace(value);
            clearError("place");
          }}
          placeholder="np. Warszawa, Mokotów"
          error={errors.place}
          icon={<MapPin className="size-4" />}
        />

        <FormField
          id="time"
          label="Czas"
          value={time}
          onChange={(value) => {
            setTime(value);
            clearError("time");
          }}
          placeholder="np. sobota popołudnie"
          error={errors.time}
          icon={<Clock className="size-4" />}
        />

        <FormField
          id="childAge"
          type="number"
          label="Wiek dziecka"
          value={childAge}
          onChange={(value) => {
            setChildAge(value);
            clearError("childAge");
          }}
          placeholder="np. 7"
          error={errors.childAge}
          icon={<User className="size-4" />}
        />

        <div>
          <label htmlFor="indoorOutdoor" className="mb-1 block text-sm font-medium text-slate-700">
            Lokalizacja aktywności
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400">
              <Trees className="size-4" />
            </span>
            <select
              id="indoorOutdoor"
              name="indoorOutdoor"
              value={indoorOutdoor}
              onChange={(e) => {
                setIndoorOutdoor(e.target.value as IndoorOutdoor);
                clearError("indoorOutdoor");
              }}
              className={cn(
                selectBase,
                errors.indoorOutdoor ? "border-red-300 focus:ring-red-400/40" : "focus:ring-amber-400/50",
              )}
            >
              {INDOOR_OUTDOOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.indoorOutdoor ? <p className="mt-1 text-xs text-red-700">{errors.indoorOutdoor}</p> : null}
        </div>

        <ServerError message={serverError} />

        <Button
          type="submit"
          disabled={loading}
          className={cn(
            "h-auto w-full rounded-xl bg-amber-600 px-4 py-2.5 text-base font-semibold text-white shadow-md",
            "hover:bg-amber-700",
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Szukam propozycji…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="size-4" />
              Szukaj propozycji
            </span>
          )}
        </Button>
      </form>

      {suggestions.length > 0 ? (
        <section className="space-y-4" aria-label="Propozycje aktywności">
          <h2 className="text-lg font-semibold text-slate-900">Wyniki</h2>
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={`${suggestion.title}-${index}`}
                title={suggestion.title}
                summary={suggestion.summary}
                sourceUrl={suggestion.sourceUrl}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
