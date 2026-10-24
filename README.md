# Shazam for Raycast (Windows)

A [Raycast](https://www.raycast.com) extension for Windows that identifies the song playing on your PC. It records a few seconds of system audio ("what you hear") and recognizes it with Shazam, then gives you quick links to Spotify, YouTube Music, Apple Music and Shazam.

Because it listens to the system's output instead of a microphone, it works with anything playing on your PC: browser tabs, music apps, videos, games.

> **Unofficial.** This project is not affiliated with, endorsed by or connected to Shazam or Apple. It talks to an undocumented Shazam endpoint that may change or stop working at any time. All trademarks and logos belong to their respective owners.

## Features

- **Recognize**: records system audio, identifies the song and shows the cover art, artist, album and release year.
- **History**: every match is saved locally, so you can search, reopen, remove or clear songs later.
- Open the song on **Spotify**, **YouTube Music**, **Apple Music** or **Shazam**. When Shazam has no direct link for a service, the extension opens a search on that service instead, so every service is always available.
- Your preferred service is the first action, so pressing Enter opens the song there.
- If nothing is playing, the extension says so without contacting Shazam.

## Requirements

- Windows 10 or 11
- Raycast for Windows 2.x
- [Node.js](https://nodejs.org) 22.22.2 or newer (only needed to install the extension)

## Installation

The extension isn't in the Raycast Store. To install it from source:

```bash
git clone https://github.com/erenalpars/Shazam-Raycast.git
cd Shazam-Raycast
npm install
npm run dev
```

`npm run dev` builds the extension and adds it to Raycast. You can stop it afterwards; the extension stays installed.

## Preferences

| Preference | Default | Description |
| --- | --- | --- |
| Recording Duration | 5 seconds | How long to record before recognizing (3, 5, 8, 10 or 12 seconds). Shazam uses at most 8 seconds of audio, and 5 is usually enough. |
| Primary Music Service | Spotify | The service listed first after a match, so Enter opens the song there. |

## How it works

1. **Capture**: `assets/record-loopback.ps1` uses WASAPI loopback capture (through inline C# compiled with PowerShell's `Add-Type`) to record the default output device. It converts the audio to 16 kHz mono WAV, which is the format Shazam's fingerprinting expects. No ffmpeg or other external binaries are needed.
2. **Fingerprint**: [`shazamio-core`](https://github.com/shazamio/shazamio-core) (WebAssembly) builds a Shazam signature from the recording.
3. **Recognize**: the signature is sent to Shazam using the same request shape as [ShazamIO](https://github.com/shazamio/ShazamIO).

The recording is deleted right after recognition. History is stored only in Raycast's local storage on your PC.

## Limitations

- Only the **default output device** is recorded. Audio playing on another device isn't captured.
- Audio has to be playing while it records. Paused or muted playback comes back as silence.
- The first recognition after starting Raycast takes 1–2 seconds longer while PowerShell compiles the capture code.

## Credits

- [ShazamIO](https://github.com/shazamio/ShazamIO) and [shazamio-core](https://github.com/shazamio/shazamio-core) (MIT) for the signature algorithm and the request format.

## License

[MIT](LICENSE)
