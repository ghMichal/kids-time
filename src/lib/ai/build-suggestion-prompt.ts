import type { SuggestionRequest } from "@/lib/ai/suggestion-request.schema";

export interface OpenRouterMessage {
  role: "system" | "user";
  content: string;
}

const INDOOR_OUTDOOR_LABELS: Record<SuggestionRequest["indoorOutdoor"], string> = {
  indoor: "w pomieszczeniu",
  outdoor: "na zewnątrz",
  either: "w pomieszczeniu lub na zewnątrz",
};

export function buildSuggestionPrompt(criteria: SuggestionRequest): { messages: OpenRouterMessage[] } {
  const indoorLabel = INDOOR_OUTDOOR_LABELS[criteria.indoorOutdoor];

  return {
    messages: [
      {
        role: "system",
        content: [
          "Jesteś asystentem planującym aktywności dla rodziców z dziećmi w Polsce.",
          "Zwracasz wyłącznie JSON zgodny ze schematem — bez markdown ani komentarzy.",
          "Podaj od 3 do 5 zwięzłych propozycji aktywności dopasowanych do kryteriów.",
          "Każda propozycja: krótki tytuł (max ~10 słów) i summary (1–2 zdania, konkretne).",
          "sourceUrl: opcjonalny link do źródła/inspiracji; jeśli brak — pusty string.",
          "Propozycje muszą być realistyczne dla podanego wieku, miejsca, czasu i indoor/outdoor.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Miejsce: ${criteria.place}`,
          `Czas: ${criteria.time}`,
          `Wiek dziecka: ${criteria.childAge} lat`,
          `Preferencja: ${indoorLabel}`,
        ].join("\n"),
      },
    ],
  };
}
