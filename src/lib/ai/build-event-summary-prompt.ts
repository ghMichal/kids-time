import type { EventSummaryRequest } from "@/lib/ai/event-summary-request.schema";
import type { OpenRouterMessage } from "@/lib/ai/build-suggestion-prompt";

const LOCATION_KIND_LABELS: Record<"indoor" | "outdoor", string> = {
  indoor: "w pomieszczeniu",
  outdoor: "na zewnątrz",
};

function formatOptional(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return `${label}: ${value}`;
}

export function buildEventSummaryPrompt(input: EventSummaryRequest): { messages: OpenRouterMessage[] } {
  const childAgeLabel = input.childAge === null || input.childAge === undefined ? null : `${input.childAge} lat`;

  const details = [
    `Tytuł: ${input.title}`,
    formatOptional("Opis", input.description),
    formatOptional("Miejsce", input.place),
    formatOptional("Wiek dziecka", childAgeLabel),
    formatOptional("Lokalizacja", input.locationKind ? LOCATION_KIND_LABELS[input.locationKind] : null),
  ].filter((line): line is string => line !== null);

  return {
    messages: [
      {
        role: "system",
        content: [
          "Jesteś asystentem pomagającym rodzicom w Polsce planować aktywności dla dzieci.",
          "Na podstawie podanych pól wydarzenia napisz krótkie podsumowanie dla rodzica.",
          "Zwracasz wyłącznie JSON zgodny ze schematem — bez markdown ani komentarzy.",
          "Pole summary: 1–2 zdania, konkretne, po polsku, maksymalnie 200 znaków.",
          "Nie wymyślaj faktów spoza podanych pól; możesz lekko przeformułować treść.",
        ].join(" "),
      },
      {
        role: "user",
        content: details.join("\n"),
      },
    ],
  };
}
