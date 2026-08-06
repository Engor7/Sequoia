# Project icons

Project SVGs live in `icons/` as small React components. Import them from the
shared entry point:

```tsx
import { Button } from '@heroui/react'
import { AddIcon } from '../../shared/ui/icon'

<Button size="sm">
  <AddIcon />
  Add item
</Button>

<Button aria-label="Add item" isIconOnly size="sm">
  <AddIcon />
</Button>
```

An icon inside a labelled control is decorative, so it does not need its own
title. Give a standalone meaningful icon a title:

```tsx
<WarningIcon className="text-warning" title="Warning" />
```

## Adding an SVG

1. Create `icons/MeaningfulNameIcon.tsx`.
2. Keep the original `viewBox`; remove fixed `width` and `height`.
3. Remove editor metadata, embedded styles, scripts, raster data, and unused
   `defs`.
4. For a single-color icon, replace fixed colors with `currentColor`. Preserve
   intentional brand or status colors only when color is part of the asset.
5. Convert SVG attributes to React casing (`fill-rule` becomes `fillRule`,
   `stroke-linecap` becomes `strokeLinecap`, and so on).
6. Export the icon from `icons/index.ts`.
7. Run `npm run check`, then verify the result inside the After Effects CEP
   panel.

Use this template:

```tsx
import { createIcon } from '../createIcon'

export const AddIcon = createIcon(
  'AddIcon',
  '0 0 24 24',
  <path d="..." />,
)
```

`SvgIcon` defaults to 16 pixels, inherits text color through `currentColor`,
accepts `size`, `className`, and all normal SVG props, and forwards its ref.
HeroUI buttons apply their own responsive SVG dimensions automatically.
