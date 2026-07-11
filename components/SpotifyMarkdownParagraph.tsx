import { Children, ReactNode, isValidElement } from "react";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { parseSpotifyDirective, parseSpotifyUrl } from "@/lib/spotify";

type ParagraphProps = React.ComponentProps<"p">;

type ElementWithChildren = {
  children?: ReactNode;
};

export function SpotifyMarkdownParagraph({ children, ...props }: ParagraphProps) {
  const text = textFromNode(children);
  const embed = parseSpotifyDirective(text) ?? parseSpotifyUrl(text);
  return embed ? <SpotifyEmbed embed={embed} /> : <p {...props}>{children}</p>;
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");

  if (isValidElement<ElementWithChildren>(node)) {
    return textFromNode(node.props.children);
  }

  return Children.toArray(node).map(textFromNode).join("");
}
