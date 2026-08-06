# Sequoia

Sequoia is a CEP panel for Adobe After Effects.

## How the panel loads

`CSXS/manifest.xml` points at `cep/panel.html`, which picks a source at startup:

1. The Vite dev server on `http://127.0.0.1:5173/`, when it is reachable.
2. Otherwise the production build in `dist/`.
3. If neither exists, it shows what to run and keeps retrying.

So a development panel hot reloads, and an installed panel works with no dev
server. `dist/` is not committed — run `npm run build` once before using the
panel without Vite, and before packaging the extension folder for someone else.

## Development

1. Enable unsigned CEP extensions for CSXS 12:

```sh
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

2. Start the Vite dev server:

```sh
npm run dev
```

3. In After Effects 2026, open `Window > Extensions (Legacy) > Sequoia`.

React changes update through Vite HMR without restarting After Effects.
Use `Cmd+R`, `Ctrl+R`, or `F5` inside the panel to force a reload.

## Checks

```sh
npm run check
```

`npm run check` covers types, lint and the build. It cannot cover anything that
touches After Effects. Pseudo-effects, presets and expressions have to be
exercised in the host, by running these through `File > Scripts > Run Script
File...` in After Effects 2026. Each builds a throwaway composition, drives the
host API, and writes a pass/fail report:

| Script | Covers | Report |
| --- | --- | --- |
| `scripts/verify-easing-tools.jsx` | Shape, path, null, colour and vector tools | `/tmp/sequoia-easing-tools-report.txt` |
| `scripts/verify-motion-effects.jsx` | Bounce and Overshoot: preset creation, control names, value preservation on reapply, mutual replacement, removal, legacy migration | `/tmp/sequoia-motion-effects-report.txt` |

HeroUI v3 and Tailwind CSS v4 are intentionally used as the modern UI baseline. Because CEP 12 uses an older Chromium runtime, verify visual behavior inside After Effects before depending on newer CSS features.

## Pseudo-effect presets

The bundled `.ffx` files in `assets/` are generated from `SequoiaBounce.ffx`
rather than hand-edited:

```sh
npm run generate:presets
```

The generators are reproducible — a run with no source change rewrites the
same bytes.

## Icons

Keep project SVGs as normalized React components in
`src/shared/ui/icon/icons`. The shared icon shell provides consistent sizing,
`currentColor` support, refs, and accessible decorative/labelled behavior.
See the [icon guide](src/shared/ui/icon/README.md) before adding an asset.
