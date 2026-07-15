# DropShelf architecture

DropShelf is an Electron application with a React renderer and a deliberately narrow native bridge.

## Process boundaries

### Main process

`electron/main.ts` owns operating-system capabilities:

- window placement and edge collapse;
- global shortcut and tray menu;
- file metadata and native icons;
- native drag-out;
- clipboard reads and writes;
- local state persistence;
- shell open and reveal operations.

### Preload bridge

`electron/preload.ts` exposes a typed, allow-listed API through `contextBridge`. It translates explicit renderer requests to IPC messages. It is the only privileged boundary available to the UI.

### Renderer

`src/App.tsx` contains the product interaction and visual state. It cannot import Node.js modules or access arbitrary filesystem paths. `src/api.ts` also provides a safe browser-preview adapter for visual development.

## Persistence

State is written to `dropshelf-state.json` under Electron's `userData` directory. Writes are serialized and use a temporary file before replacement. Clipboard images are encoded as PNG under `userData/captured`.

Dropped files are references. DropShelf stores their absolute path and metadata but never modifies the source. Text and links live directly in the JSON state.

## Window model

One frameless window alternates between two sizes:

- collapsed: an 18-pixel edge handle;
- expanded: a 440-pixel shelf.

The current display is chosen from the mouse cursor location. The shelf is vertically centered inside the display work area, respects the configured edge, and stays out of the taskbar.

## Trust boundaries

- Content Security Policy limits scripts, images, and network connections.
- User content renders as React text, never raw HTML.
- External navigation accepts only HTTP and HTTPS URLs.
- Item IDs are resolved against in-memory state before privileged operations.
- The application has no remote data path.
