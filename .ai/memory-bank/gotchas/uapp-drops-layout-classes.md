# UApp drops layout classes on its root

## Symptom

Map viewport reports a huge `clientHeight` (unscaled grid height), pan-clamp locks `y` at `0`, and you cannot pan to the bottom of the kanji list. The map section visually overflows past the window while ancestors use `overflow: hidden`.

## Cause

`<UApp class="flex h-dvh …">` does not keep those utilities on the rendered root (only Nuxt UI’s `isolate` remains). Without a definite-height flex column, `UMain` / the grid grow to the **unscaled** transform child’s layout box. Clamp then compares `contentH * scale` against that oversized viewport and treats the axis as “fits.”

## Fix

Put shell layout on a wrapper inside `UApp`, not on `UApp` itself:

```vue
<UApp>
  <div class="flex h-dvh flex-col overflow-hidden">
    <UHeader class="shrink-0" … />
    <UMain class="flex min-h-0 flex-1 flex-col overflow-hidden">…</UMain>
  </div>
</UApp>
```
