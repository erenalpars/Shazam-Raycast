import { ActionPanel, Detail } from "@raycast/api";
import { CopyActions, OpenActions } from "./track-actions";
import type { RecognizedTrack } from "./types";

/**
 * The card for one recognized track. Shared so a fresh match and a history
 * entry look identical; callers pass whatever extra action fits their screen.
 */
export function TrackDetail({ track, extraActions }: { track: RecognizedTrack; extraActions?: React.ReactNode }) {
  const cover = track.coverUrl
    ? `![Cover](${track.coverUrl}${track.coverUrl.includes("?") ? "&" : "?"}raycast-width=220&raycast-height=220)\n\n`
    : "";
  return (
    <Detail
      navigationTitle={track.title}
      markdown={`${cover}# ${track.title}\n\n### ${track.artist}`}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Artist" text={track.artist} />
          {track.album && <Detail.Metadata.Label title="Album" text={track.album} />}
          {track.year && <Detail.Metadata.Label title="Released" text={track.year} />}
          {track.shazamUrl && (
            <>
              <Detail.Metadata.Separator />
              <Detail.Metadata.Link title="Shazam" target={track.shazamUrl} text="View on Shazam" />
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <OpenActions track={track} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <CopyActions track={track} />
          </ActionPanel.Section>
          {extraActions && <ActionPanel.Section>{extraActions}</ActionPanel.Section>}
        </ActionPanel>
      }
    />
  );
}
