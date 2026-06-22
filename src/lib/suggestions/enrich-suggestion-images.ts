import type { SuggestionItem } from "@/lib/ai/suggestion-response.schema";
import type { EnrichedSuggestionItem } from "@/lib/suggestions/enriched-response.schema";

const OG_FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 256 * 1024;
const OG_USER_AGENT = "kids-time/1.0 (OG enricher; +https://github.com/ghMichal/kids-time)";

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
];

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function readHtmlSnippet(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (totalBytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const remaining = MAX_HTML_BYTES - totalBytes;
    if (value.length > remaining) {
      chunks.push(value.subarray(0, remaining));
      totalBytes = MAX_HTML_BYTES;
      break;
    }

    chunks.push(value);
    totalBytes += value.length;
  }

  await reader.cancel().catch(() => undefined);

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return decoder.decode(combined);
}

function extractImageMetaContent(html: string): string | undefined {
  for (const pattern of OG_IMAGE_PATTERNS) {
    const match = html.match(pattern);
    const content = match?.[1]?.trim();
    if (content) {
      return content;
    }
  }

  return undefined;
}

function resolveHttpsImageUrl(baseUrl: string, rawValue: string): string | undefined {
  try {
    const resolved = new URL(decodeHtmlEntities(rawValue.trim()), baseUrl);
    if (resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    if (resolved.protocol !== "https:") {
      return undefined;
    }
    return resolved.href;
  } catch {
    return undefined;
  }
}

async function fetchOgImageUrl(sourceUrl: string): Promise<string | undefined> {
  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      headers: { "User-Agent": OG_USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(OG_FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch {
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  const html = await readHtmlSnippet(response);
  const metaContent = extractImageMetaContent(html);
  if (!metaContent) {
    return undefined;
  }

  return resolveHttpsImageUrl(sourceUrl, metaContent);
}

export async function enrichSuggestionImages(items: SuggestionItem[]): Promise<EnrichedSuggestionItem[]> {
  const settled = await Promise.allSettled(
    items.map(async (item) => {
      const imageUrl = item.sourceUrl ? await fetchOgImageUrl(item.sourceUrl) : undefined;
      return imageUrl ? { ...item, imageUrl } : { ...item };
    }),
  );

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return { ...items[index] };
  });
}
