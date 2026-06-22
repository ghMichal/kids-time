interface SuggestionCardProps {
  title: string;
  summary: string;
  sourceUrl?: string;
  imageUrl?: string;
}

export function SuggestionCard({ title, summary, sourceUrl, imageUrl: _imageUrl }: SuggestionCardProps) {
  return (
    <article className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
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
    </article>
  );
}
