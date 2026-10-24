import { environment } from "@raycast/api";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initSync, recognizeBytes } from "shazamio-core/web";
import type { RecognizedTrack } from "./types";

// Minimal shapes for the parts of Shazam's response we consume; the payload is
// much larger but has no published schema.
interface ShazamAction {
  type?: string;
  uri?: string;
}
interface ShazamProvider {
  type?: string;
  actions?: ShazamAction[];
}
interface ShazamMetadataItem {
  title?: string;
  text?: string;
}
interface ShazamSection {
  type?: string;
  metadata?: ShazamMetadataItem[];
}
interface ShazamTrack {
  key?: string;
  title?: string;
  subtitle?: string;
  url?: string;
  images?: { coverart?: string; coverarthq?: string };
  hub?: { providers?: ShazamProvider[]; options?: { actions?: ShazamAction[] }[] };
  sections?: ShazamSection[];
}

// The wasm ships as an asset because the bundler can't inline it; initSync
// with the raw bytes avoids any filesystem assumptions inside the module.
let wasmLoaded = false;
function ensureWasm() {
  if (wasmLoaded) return;
  const wasmBytes = fs.readFileSync(path.join(environment.assetsPath, "shazamio-core_bg.wasm"));
  initSync(wasmBytes);
  wasmLoaded = true;
}

// Request shape mirrors shazamio (MIT, github.com/shazamio/ShazamIO): POST the
// signature to the discovery endpoint with two fresh uppercase UUIDs per tag.
async function requestRecognition(uri: string, samplems: number): Promise<{ track?: ShazamTrack }> {
  const url =
    `https://amp.shazam.com/discovery/v5/en/US/iphone/-/tag/${randomUUID().toUpperCase()}/${randomUUID().toUpperCase()}` +
    `?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&hubv5minorversion=v5.1&hidelb=true&video=v3`;

  try {
    return await postSignature(url, uri, samplems);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Shazam didn't respond in time. Check your connection and try again.");
    }
    throw error;
  }
}

async function postSignature(url: string, uri: string, samplems: number): Promise<{ track?: ShazamTrack }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      "Accept-Language": "en",
      "X-Shazam-Platform": "IPHONE",
      "X-Shazam-AppVersion": "14.1.0",
      "User-Agent": "Shazam/14.1.0 (iPhone; iOS 16.0; Scale/3.00)",
    },
    body: JSON.stringify({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      signature: { uri, samplems },
      timestamp: Date.now(),
      context: {},
      geolocation: {},
    }),
    // Without a deadline a stalled connection leaves the view on "Identifying…" forever.
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Shazam responded with HTTP ${response.status}.`);
  }
  return (await response.json()) as { track?: ShazamTrack };
}

/**
 * Recognizes a 16 kHz mono s16le WAV (as written by the loopback recorder).
 * Returns null when Shazam has no match.
 */
export async function recognizeWavFile(wavPath: string): Promise<RecognizedTrack | null> {
  ensureWasm();
  const wav = fs.readFileSync(wavPath);
  const signatures = recognizeBytes(new Uint8Array(wav));
  if (signatures.length === 0) return null;

  // Keep the signature covering the most audio; free the wasm-side memory
  // before the network round trip.
  const best = signatures.reduce((a, b) => (b.samplems > a.samplems ? b : a));
  const uri = best.uri;
  const samplems = best.samplems;
  for (const signature of signatures) signature.free();

  const track = (await requestRecognition(uri, samplems)).track;
  if (!track?.title) return null;

  const songSection = track.sections?.find((s) => s.type === "SONG");
  const meta = (name: string) => songSection?.metadata?.find((m) => m.title === name)?.text;
  const providerUri = (type: string) =>
    track.hub?.providers?.find((p) => p.type === type)?.actions?.find((a) => a.uri)?.uri;
  const appleMusicOpenUri = track.hub?.options
    ?.flatMap((o) => o.actions ?? [])
    .find((a) => a.type === "applemusicopen")?.uri;

  const title = track.title;
  return {
    id: `${track.key ?? title}-${Date.now()}`,
    title,
    artist: track.subtitle ?? "Unknown Artist",
    album: meta("Album"),
    year: meta("Released"),
    coverUrl: track.images?.coverarthq ?? track.images?.coverart,
    shazamUrl: track.url,
    spotifyUrl: spotifyWebUrl(providerUri("SPOTIFY")),
    youtubeMusicUrl: httpsUrl(providerUri("YOUTUBEMUSIC")),
    appleMusicUrl: cleanAppleMusicUrl(appleMusicOpenUri),
    recognizedAt: Date.now(),
  };
}

// Shazam's Spotify provider is usually just a spotify:search: deeplink, which
// the search fallback covers anyway; only a real track URI is worth keeping.
function spotifyWebUrl(uri: string | undefined): string | undefined {
  const id = uri?.match(/^spotify:track:([A-Za-z0-9]+)$/)?.[1];
  return id ? `https://open.spotify.com/track/${id}` : undefined;
}

// Provider links are opened in the browser, so app deeplinks are dropped and
// the search fallback is used instead.
function httpsUrl(uri: string | undefined): string | undefined {
  return uri?.startsWith("https://") ? uri : undefined;
}

// The applemusicopen link points at the exact track (album path + ?i=<track>)
// but carries Shazam's referral parameters (mttn*, itscg, itsct, app); keep
// only the track parameter.
function cleanAppleMusicUrl(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    const url = new URL(uri);
    if (url.hostname !== "music.apple.com") return undefined;
    const trackId = url.searchParams.get("i");
    url.search = trackId ? `?i=${trackId}` : "";
    return url.toString();
  } catch {
    return undefined;
  }
}
