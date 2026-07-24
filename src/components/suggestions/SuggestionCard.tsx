import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TriageActionStatus = "accepted" | "rejected" | "maybe";

interface SuggestionCardProps {
  clientId: string;
  title: string;
  summary: string;
  sourceUrl?: string;
  imageUrl?: string;
  triagePending?: boolean;
  onTriage?: (status: TriageActionStatus) => void;
}

export function SuggestionCard({
  clientId: _clientId,
  title,
  summary,
  sourceUrl,
  imageUrl,
  triagePending = false,
  onTriage,
}: SuggestionCardProps) {
  const [imageHidden, setImageHidden] = useState(false);
  const showImage = Boolean(imageUrl) && !imageHidden;
  const showActions = typeof onTriage === "function";

  return (
    <article className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
      {showImage ? (
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="aspect-video w-full object-cover"
          onError={() => {
            setImageHidden(true);
          }}
        />
      ) : null}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{summary}</p>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-amber-800 hover:text-amber-950 hover:underline"
          >
            Zobacz źródło
          </a>
        ) : null}
        {showActions ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-100 pt-4">
            <Button
              type="button"
              size="sm"
              disabled={triagePending}
              onClick={() => {
                onTriage("accepted");
              }}
              className={cn(
                "rounded-lg bg-amber-600 text-white shadow-sm hover:bg-amber-700",
                "focus-visible:ring-amber-400/50",
              )}
            >
              Akceptuj
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={triagePending}
              onClick={() => {
                onTriage("rejected");
              }}
              className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              Odrzuć
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={triagePending}
              onClick={() => {
                onTriage("maybe");
              }}
              className="rounded-lg border-amber-200 text-amber-900 hover:bg-amber-50"
            >
              Może później
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
