# Sequoia Agent Notes

## Where things live

- `cep/panel.html` is the entry point named by the manifest. It picks the Vite dev server when it is running and the `dist/` build otherwise, so never assume a dev server is present.
- `src/shared/cep/cs-interface.ts` is the only place that talks to CEP. `host-command.ts` sits on top and owns the whole `ok|N` / `noop|N` / `partial|N|details` / `error|message` protocol plus the repeat-press guard. Call `runHostCommand`; do not call `evalHostScript` directly from a page, and do not hand-parse a host result.
- `src/shared/cep/motion-effects.ts` is the single poller for After Effects selection state. After Effects has no selection event, so anything that needs to know what the selection carries subscribes to that store instead of adding a timer.
- `jsx/shared.jsx` holds helpers common to the host scripts and is loaded first by `host.jsx`. Alias what you need at the top of a script's closure rather than redefining it.
- Buttons on the Main page are described as data in `src/pages/main/motionTools.ts` and rendered by one component each. Add a tool by adding a record, not by writing new JSX.

## Rules

- Build UI with HeroUI first. Create local components only when HeroUI has no suitable primitive.
- Keep custom components visually aligned with HeroUI: compact spacing, dark CEP-friendly surfaces, restrained borders, and no decorative gradients.
- Use SCSS only for Sequoia-specific styling and CEP shell concerns. Keep library styling in Tailwind/HeroUI CSS.
- Treat CEP as an older Chromium runtime. Verify modern CSS and Web APIs inside After Effects before relying on them.
- CEP can expose `PointerEvent` while physical panel input emits only legacy mouse events. React Aria/HeroUI `onPress` may therefore work in a browser or with a synthetic DevTools click but not with a real mouse in After Effects. Keep `onPress` for keyboard and browser accessibility, and add an idempotent left-button `onMouseUp` fallback to critical HeroUI controls. Do not rely on `onClick` alone, and verify navigation with a physical mouse inside After Effects.
- HeroUI may place hover visuals behind `@media (hover: hover)`, while CEP can report that media query as false even though a physical mouse still triggers CSS `:hover`. For critical HeroUI controls, keep the library `data-hovered` state and add an equivalent explicit `:hover` style outside hover-capability media queries. Verify hover visuals with a physical mouse inside After Effects.
- When an After Effects tool exposes several settings for one behavior, represent them as child properties of one effect in Effect Controls. Do not create a separate `Slider Control`, `Checkbox Control`, or other expression-control effect for every setting. Use a bundled `.ffx` pseudo-effect with a stable custom match name instead. For example, Bounce must appear as one `Bounce Position` or `Bounce Scale` effect containing `Amount`, `Duration`, and `Elasticity`.
- Expressions for a pseudo-effect must reference that single effect and its child controls. Reapplying the tool must reuse the effect and preserve the user's current values rather than adding duplicates. If an older implementation used separate expression-control effects, migrate them on reapplication: read their values, create and validate the new pseudo-effect, update the expression, and only then remove the legacy controls.
- Do not treat browser behavior, static inspection, or mocks as sufficient validation for AE effects and presets. Run an integration check inside the supported After Effects version and confirm the pseudo-effect match name, visible child-property names and defaults, expression errors, value preservation on reapplication, and legacy migration before considering the implementation complete.
- During development, run `npm run dev` and open `Window > Extensions (Legacy) > Sequoia` in After Effects 2026.
