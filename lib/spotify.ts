const SPOTIFY_KINDS = ["track", "album", "playlist", "artist", "episode", "show"] as const;

export type SpotifyKind = (typeof SPOTIFY_KINDS)[number];

export type SpotifyEmbed = {
  kind: SpotifyKind;
  id: string;
  url: string;
  embedUrl: string;
};

const SPOTIFY_DIRECTIVE_PATTERN = /^:{1,2}spotify\[(.+)\]$/i;

function isSpotifyKind(value: string): value is SpotifyKind {
  return SPOTIFY_KINDS.includes(value.toLowerCase() as SpotifyKind);
}

export function parseSpotifyUrl(value: string): SpotifyEmbed | null {
  const raw = value.trim().replace(/^<|>$/g, "");
  const uriMatch = raw.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/i);

  if (uriMatch) {
    return buildSpotifyEmbed(uriMatch[1], uriMatch[2]);
  }

  const maybeUrl = raw.startsWith("open.spotify.com") ? `https://${raw}` : raw;

  try {
    const url = new URL(maybeUrl);
    if (url.hostname !== "open.spotify.com") return null;

    const segments = url.pathname.split("/").filter(Boolean);
    const kindIndex = segments.findIndex(isSpotifyKind);
    const kind = kindIndex >= 0 ? segments[kindIndex] : "";
    const id = segments[kindIndex + 1] || "";

    if (!isSpotifyKind(kind) || !/^[A-Za-z0-9]+$/.test(id)) return null;
    return buildSpotifyEmbed(kind, id);
  } catch {
    return null;
  }
}

export function parseSpotifyDirective(value: string): SpotifyEmbed | null {
  const match = value.trim().match(SPOTIFY_DIRECTIVE_PATTERN);
  return match ? parseSpotifyUrl(match[1]) : null;
}

export function createSpotifyDirective(value: string): string | null {
  const embed = parseSpotifyUrl(value);
  return embed ? `::spotify[${embed.url}]` : null;
}

function buildSpotifyEmbed(kind: string, id: string): SpotifyEmbed | null {
  const normalizedKind = kind.toLowerCase();
  if (!isSpotifyKind(normalizedKind)) return null;

  return {
    kind: normalizedKind,
    id,
    url: `https://open.spotify.com/${normalizedKind}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${normalizedKind}/${id}`,
  };
}
