<script setup lang="ts">
import {
  KANJIVG_ATTRIBUTION_TEXT,
  KANJIVG_ATTRIBUTION_URL,
  kanjiVgSvgUrl,
  prepareKanjiVgSvgMarkup
} from '../../shared/utils/kanjivg'

const props = defineProps<{
  character: string
}>()

const host = ref<HTMLElement | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
const STROKE_MS = 420
const GAP_MS = 80

function clearHost() {
  if (host.value) host.value.replaceChildren()
}

function clearAnimation(paths: SVGPathElement[]) {
  for (const path of paths) {
    path.style.transition = 'none'
    path.style.strokeDasharray = ''
    path.style.strokeDashoffset = ''
    path.style.opacity = ''
  }
}

function strokePaths(root: SVGSVGElement): SVGPathElement[] {
  return Array.from(root.querySelectorAll('g[id^="kvg:StrokePaths"] path')) as SVGPathElement[]
}

function playStrokeAnimation() {
  const root = host.value?.querySelector('svg')
  if (!root) return
  const paths = strokePaths(root)
  if (!paths.length) return

  clearAnimation(paths)

  for (const path of paths) {
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    path.style.opacity = '1'
  }

  // Force layout so the initial dashoffset applies before transitions.
  void root.getBoundingClientRect()

  paths.forEach((path, index) => {
    const delay = index * (STROKE_MS + GAP_MS)
    path.style.transition = `stroke-dashoffset ${STROKE_MS}ms ease-in-out ${delay}ms`
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0'
    })
  })
}

function mountSvgMarkup(markup: string): boolean {
  if (!host.value) return false
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const svg = parsed.querySelector('svg')
  if (!svg || parsed.querySelector('parsererror')) return false
  host.value.replaceChildren(document.importNode(svg, true))
  return true
}

async function loadSvg(character: string) {
  const url = kanjiVgSvgUrl(character)
  if (!url) {
    status.value = 'missing'
    clearHost()
    return
  }

  status.value = 'loading'
  clearHost()

  try {
    const res = await fetch(url)
    if (character !== props.character) return
    if (res.status === 404) {
      status.value = 'missing'
      return
    }
    if (!res.ok) {
      status.value = 'error'
      return
    }

    const markup = prepareKanjiVgSvgMarkup(await res.text())
    if (character !== props.character) return

    status.value = 'ready'
    await nextTick()
    const ok = mountSvgMarkup(markup)
    if (!ok) {
      status.value = 'error'
      clearHost()
      return
    }
    playStrokeAnimation()
  } catch {
    if (character !== props.character) return
    status.value = 'error'
    clearHost()
  }
}

function replay() {
  if (status.value !== 'ready') return
  playStrokeAnimation()
}

watch(
  () => props.character,
  (character) => {
    void loadSvg(character)
  },
  { immediate: true }
)
</script>

<template>
  <aside class="flex w-[6.75rem] min-h-[6.75rem] flex-col rounded-lg border border-default bg-elevated">
    <div class="flex items-center justify-between gap-1 px-2 pt-2">
      <p class="text-xs leading-none text-muted">
        Strokes
      </p>
      <UButton
        v-if="status === 'ready'"
        size="xs"
        color="neutral"
        variant="ghost"
        square
        icon="i-lucide-rotate-ccw"
        aria-label="Replay stroke order"
        @click="replay"
      />
    </div>

    <p
      v-if="status === 'loading' || status === 'missing' || status === 'error'"
      class="flex flex-1 items-center px-2 py-2 text-[0.65rem] leading-snug text-muted"
    >
      <template v-if="status === 'loading'">
        Loading…
      </template>
      <template v-else-if="status === 'missing'">
        Not available
      </template>
      <template v-else>
        Could not load
      </template>
    </p>

    <div
      v-show="status === 'ready'"
      class="flex min-h-0 flex-1 flex-col px-1.5 pb-1.5 pt-1"
    >
      <div
        ref="host"
        class="kanji-stroke-order min-h-0 w-full flex-1 text-highlighted"
      />
      <a
        :href="KANJIVG_ATTRIBUTION_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-0.5 truncate text-center text-[0.55rem] leading-none text-muted underline decoration-default underline-offset-2 hover:text-highlighted"
        :title="KANJIVG_ATTRIBUTION_TEXT"
      >
        KanjiVG
      </a>
    </div>
  </aside>
</template>

<style scoped>
.kanji-stroke-order :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.kanji-stroke-order :deep(g[id^='kvg:StrokePaths'] path) {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.kanji-stroke-order :deep(g[id^='kvg:StrokeNumbers']) {
  fill: color-mix(in oklab, currentColor 45%, transparent);
  font-size: 8px;
}
</style>
