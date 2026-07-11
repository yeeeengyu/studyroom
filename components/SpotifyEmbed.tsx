import type { SpotifyEmbed as SpotifyEmbedData } from "@/lib/spotify";

type SpotifyEmbedProps = {
  embed: SpotifyEmbedData;
};

export function SpotifyEmbed({ embed }: SpotifyEmbedProps) {
  return (
    <div className="spotify-embed">
      <iframe
        src={embed.embedUrl}
        title={`Spotify ${embed.kind}`}
        width="100%"
        height="152"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
