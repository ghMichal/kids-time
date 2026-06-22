import { useState } from "react";

interface SuggestionCardProps {
  title: string;
  summary: string;
  sourceUrl?: string;
  imageUrl?: string;
}

export function SuggestionCard({ title, summary, sourceUrl, imageUrl }: SuggestionCardProps) {
  const [imageHidden, setImageHidden] = useState(false);
  const showImage = Boolean(imageUrl) && !imageHidden;

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
      </div>
    </article>
  );
}
