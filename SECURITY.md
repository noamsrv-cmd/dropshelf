# Security policy

## Supported versions

Security updates are provided for the latest stable release.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature in the repository Security tab. Include the affected version, reproduction steps, potential impact, and any suggested mitigation.

## Security model

- The renderer runs with `nodeIntegration: false`, context isolation, and Chromium sandboxing.
- Privileged behavior is available only through the typed preload bridge.
- Navigation and unexpected new windows are denied; HTTP and HTTPS links open through the operating system.
- File operations are scoped to paths explicitly added by the user.
- Removing an item from DropShelf never removes its original file.
- Clipboard history is opt-in and stored locally.
- No analytics, telemetry, remote API, or update server is included.

## Release signing

The source and workflows support signing, but public release certificates and notarization credentials are not stored in the repository. Until signed builds are published, operating systems may show an unknown-publisher warning. Never bypass security warnings for a binary obtained outside the repository's official Releases page.
