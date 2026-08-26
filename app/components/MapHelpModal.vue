<script setup lang="ts">
import { ACCURACY_HEATMAP_PALETTE } from '../../shared/utils/colors'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  /** When false, hide accuracy corner and WK-gated color legends. */
  wanikaniConfigured?: boolean
}>()

const heatmapGradient = `linear-gradient(to right, ${ACCURACY_HEATMAP_PALETTE.join(', ')})`

const yearLegend = [
  { label: '小1', className: 'km-year km-g1' },
  { label: '小2', className: 'km-year km-g2' },
  { label: '小3', className: 'km-year km-g3' },
  { label: '小4', className: 'km-year km-g4' },
  { label: '小5', className: 'km-year km-g5' },
  { label: '小6', className: 'km-year km-g6' },
  { label: '中学+', className: 'km-year km-jh' },
  { label: 'Other', className: 'km-year km-other' }
] as const

const jlptLegend = [
  { label: 'N5', className: 'km-jlpt km-n5' },
  { label: 'N4', className: 'km-jlpt km-n4' },
  { label: 'N3', className: 'km-jlpt km-n3' },
  { label: 'N2', className: 'km-jlpt km-n2' },
  { label: 'N1', className: 'km-jlpt km-n1' },
  { label: 'None', className: 'km-jlpt km-other' }
] as const

const srsLegend = [
  { label: 'Apprentice', className: 'km-srs km-apprentice' },
  { label: 'Guru', className: 'km-srs km-guru' },
  { label: 'Master', className: 'km-srs km-master' },
  { label: 'Enlightened', className: 'km-srs km-enlightened' },
  { label: 'Burned', className: 'km-srs km-burned' }
] as const

const statusLegend = [
  { label: 'Unstudied', className: 'km-srs km-unstudied', note: 'In WaniKani, no positive SRS yet' },
  { label: 'Untracked', className: 'km-srs km-untracked', note: 'On the map, not in WaniKani' }
] as const
</script>

<template>
  <UModal
    v-model:open="open"
    title="Map help"
    scrollable
    :ui="{
      content: 'sm:max-w-[900px] -mt-2.5'
    }"
  >
    <template #body>
      <div class="space-y-5 text-sm">
        <section class="space-y-3">
          <h3 class="font-semibold text-highlighted">
            Cell labels
          </h3>
          <p class="text-muted">
            Each cell is a kanji. The background color comes from the selected color mode.
            Corner numbers are fixed metadata (not the color mode).
          </p>

          <div class="flex flex-wrap items-center gap-8">
            <!-- Map cell is 44×55; scale up so glyphs fill like on the map. -->
            <div
              class="shrink-0"
              style="width: 7.5625rem; height: 9.453125rem"
              aria-hidden="true"
            >
              <div
                class="relative flex items-center justify-center rounded-sm km-year km-g3 text-base font-medium leading-none origin-top-left"
                style="width: 44px; height: 55px; transform: scale(2.75)"
              >
                <span class="km-kanji select-none text-gray-900 dark:text-gray-950">
                  漢
                </span>
                <span class="pointer-events-none absolute top-0.5 left-0.5 text-[0.6rem] font-bold leading-none text-gray-900">
                  42
                </span>
                <span class="pointer-events-none absolute top-0.5 right-0.5 text-[0.5rem] leading-none text-gray-800/80">
                  13
                </span>
                <span class="pointer-events-none absolute bottom-0.5 left-0.5 text-[0.5rem] leading-none text-gray-800/80">
                  4
                </span>
                <span
                  v-if="wanikaniConfigured !== false"
                  class="pointer-events-none absolute bottom-0.5 right-0.5 text-[0.6rem] leading-none text-gray-800/80"
                >
                  87%
                </span>
              </div>
            </div>

            <ul class="min-w-0 flex-1 grid gap-x-8 gap-y-1.5 text-muted sm:grid-cols-2">
              <li>
                <span class="font-medium text-highlighted">Top-left</span>
                — jōyō appearance index (1-based). Stable across order modes.
              </li>
              <li>
                <span class="font-medium text-highlighted">Top-right</span>
                — stroke count (<code class="text-xs">—</code> if unknown).
              </li>
              <li>
                <span class="font-medium text-highlighted">Bottom-left</span>
                — number of distinct on/kun reading stems (okurigana variants collapsed; nanori excluded).
              </li>
              <li v-if="wanikaniConfigured !== false">
                <span class="font-medium text-highlighted">Bottom-right</span>
                — review accuracy % (blank until there is positive SRS). Only available with a configured WK key.
              </li>
              <li v-else>
                <span class="font-medium text-highlighted">Bottom-right</span>
                — accuracy is hidden until a WaniKani API key is configured.
              </li>
              <li>
                Click a cell for meanings, readings, stroke order, and source links.
              </li>
            </ul>
          </div>
        </section>

        <div class="grid gap-5 lg:grid-cols-2">
          <section class="space-y-3">
            <h3 class="font-semibold text-highlighted">
              Color mode legends
            </h3>

            <div class="space-y-2">
              <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
                School year
              </h4>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="item in yearLegend"
                  :key="item.label"
                  class="flex items-center gap-1.5"
                >
                  <span
                    class="inline-block size-5 shrink-0 rounded-sm"
                    :class="item.className"
                  />
                  <span class="text-muted">{{ item.label }}</span>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
                JLPT level
              </h4>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="item in jlptLegend"
                  :key="item.label"
                  class="flex items-center gap-1.5"
                >
                  <span
                    class="inline-block size-5 shrink-0 rounded-sm"
                    :class="item.className"
                  />
                  <span class="text-muted">{{ item.label }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="wanikaniConfigured !== false"
              class="space-y-2"
            >
              <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
                SRS stage
              </h4>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="item in srsLegend"
                  :key="item.label"
                  class="flex items-center gap-1.5"
                >
                  <span
                    class="inline-block size-5 shrink-0 rounded-sm"
                    :class="item.className"
                  />
                  <span class="text-muted">{{ item.label }}</span>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
                Heatmaps
              </h4>
              <p class="text-muted">
                Accuracy, WaniKani level, stroke count, and reading count share one purple→green scale
                (low / late / complex on the left; high / early / simple on the right).
              </p>
              <div
                class="h-3 w-full rounded-sm ring ring-default"
                :style="{ background: heatmapGradient }"
                role="img"
                aria-label="Heatmap gradient from purple to green"
              />
              <ul class="space-y-1 text-muted">
                <li v-if="wanikaniConfigured !== false">
                  <span class="font-medium text-highlighted">Accuracy</span>
                  — 0% (purple) → 100% (green). Grey when there is no positive SRS.
                </li>
                <li v-if="wanikaniConfigured !== false">
                  <span class="font-medium text-highlighted">WaniKani level</span>
                  — level 60 (purple) → level 1 (green). Grey when not in the WK catalog.
                </li>
                <li>
                  <span class="font-medium text-highlighted">Stroke count</span>
                  — most strokes (purple) → fewest (green), relative to the full map.
                </li>
                <li>
                  <span class="font-medium text-highlighted">Reading count</span>
                  — most readings (purple) → fewest (green), relative to the full map.
                </li>
              </ul>
            </div>
          </section>

          <section class="space-y-2">
            <h3 class="font-semibold text-highlighted">
              School years &amp; tracking
            </h3>
            <p class="text-muted">
              School years follow MEXT’s 学年別漢字配当表 (小学校 小1–小6 only). Remaining 常用漢字 are
              taught in 中学 without an official year-by-year list — shown as 中学+. There is no national
              7–12 kanji year table.
            </p>
            <p class="text-muted">
              Light blue outline = untracked (on the map, not in WaniKani).
              Lighter grey without outline = unstudied (in WaniKani, no positive SRS yet).
            </p>
            <div class="flex flex-wrap gap-3 pt-1">
              <div
                v-for="item in statusLegend"
                :key="item.label"
                class="flex items-center gap-2"
              >
                <span
                  class="inline-block size-5 shrink-0 rounded-sm"
                  :class="item.className"
                />
                <span class="text-muted">
                  <span class="font-medium text-highlighted">{{ item.label }}</span>
                  — {{ item.note }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>
