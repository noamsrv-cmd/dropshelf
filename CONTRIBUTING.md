# Contributing to DropShelf

Thank you for helping make everyday computer work calmer.

## Before you start

- Search existing issues before opening a new one.
- Keep feature proposals focused on the temporary-shelf workflow.
- Never include clipboard contents, personal file paths, or other private data in screenshots or logs.
- For security-sensitive reports, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local setup

```bash
npm install
npm run dev
```

Before submitting a change, run:

```bash
npm run typecheck
npm test
npm run build
```

## Pull requests

1. Keep each pull request to one coherent change.
2. Explain the user problem and the interaction impact.
3. Include before/after screenshots for visible changes.
4. Add or update tests for behavior that can be tested deterministically.
5. Preserve context isolation: renderer code must not gain direct Node.js access.
6. Confirm that removing shelf items cannot delete original files.

## Design principles

- The shelf should feel instant and quiet.
- Common actions should be visible; uncommon actions can live in context menus.
- Destructive language must be unambiguous.
- Privacy settings default to the least surprising behavior.
- Native platform conventions beat clever custom behavior.
