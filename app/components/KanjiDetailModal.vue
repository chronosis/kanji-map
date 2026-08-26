<script setup lang="ts">
import type { KanjiDetailReading, KanjiDetailResponse, KanjiDetailVocabExample } from '../../shared/types/kanji-detail'
import {
  accuracyTextColor,
  formatAccuracy,
  srsBandColor
} from '../../shared/utils/colors'
import { schoolYearLabel } from '../../shared/utils/kanji-order'
import { jishoKanjiUrl } from '../../shared/utils/kanji'
import {
  hasWkReviewStats,
  wkMeaningAttempts,
  wkReadingAttempts
} from '../../shared/utils/wanikani-review-stats'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  character: string | null
}>()

const detail = ref<KanjiDetailResponse | null>(null)
const pending = ref(false)
const loadError = ref<string | null>(null)

watch(
  () => [open.value, props.character] as const,
  async ([isOpen, character]) => {
    if (!isOpen || !character) {
      detail.value = null
      loadError.value = null
      return
    }
    pending.value = true
    loadError.value = null
    detail.value = null
    try {
      detail.value = await $fetch<KanjiDetailResponse>(
        `/api/kanji/${encodeURIComponent(character)}`
      )
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load kanji detail'
    } finally {
      pending.value = false
    }
  },
  { immediate: true }
)

function close() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.code === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function readingGroups(detailValue: KanjiDetailResponse) {
  const readings = detailValue.wanikani?.readings ?? []
  const groups: Array<{ label: string, readings: KanjiDetailReading[] }> = []
  for (const type of ['onyomi', 'kunyomi', 'nanori', 'other'] as const) {
    const typeReadings = readings.filter(r => r.type === type)
    if (typeReadings.length) {
      groups.push({
        label: type === 'other' ? 'Other' : type.charAt(0).toUpperCase() + type.slice(1),
        readings: typeReadings
      })
    }
  }
  return groups
}

function exampleList(detailValue: KanjiDetailResponse): KanjiDetailVocabExample[] {
  const seen = new Set<string>()
  const merged: KanjiDetailVocabExample[] = []
  for (const item of [
    ...(detailValue.wanikani?.vocabulary ?? []),
    ...detailValue.jishoWords,
    ...detailValue.bunproWords
  ]) {
    const key = item.characters
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged.slice(0, 16)
}

function sourceLabel(source: KanjiDetailVocabExample['source']): string {
  if (source === 'wanikani') return 'WK'
  if (source === 'bunpro') return 'BP'
  return 'Jisho'
}

const jishoLink = computed(() => {
  if (detail.value?.jishoUrl) return detail.value.jishoUrl
  if (props.character) return jishoKanjiUrl(props.character)
  return undefined
})

const wanikaniLink = computed(() => detail.value?.wanikani?.documentUrl)

const headerMeanings = computed(() => {
  const wkMeanings = detail.value?.wanikani?.meanings
  if (wkMeanings?.length) {
    return wkMeanings.map(m => m.meaning).join(', ')
  }
  const jishoMeanings = detail.value?.jishoMeanings
  if (!jishoMeanings?.length) return null
  // Prefer the primary Jisho gloss; fall back to the full comma-joined list.
  const primary = jishoMeanings.find(m => m.primary)?.meaning
  return primary ?? jishoMeanings.map(m => m.meaning).join(', ')
})

/** Preferred WK reading for the header (primary flag, else first reading). */
const headerPrimaryReading = computed(() => {
  const readings = detail.value?.wanikani?.readings
  if (!readings?.length) return null
  return readings.find(r => r.primary)?.reading ?? readings[0]?.reading ?? null
})

const srsValueColor = computed(() => {
  const local = detail.value?.local
  if (!local || local.srsAvg == null) return null
  return srsBandColor(local.srsAvg)
})

const accuracyValueColor = computed(() => {
  const local = detail.value?.local
  if (!local) return null
  return accuracyTextColor(local.accuracyAvg, {
    sources: local.sources,
    srsAvg: local.srsAvg
  })
})

interface WordSegment {
  text: string
  highlight: boolean
}

/** Split a word so occurrences of the modal kanji can be styled. */
function wordSegments(word: string, kanji: string | null): WordSegment[] {
  if (!kanji || !word.includes(kanji)) {
    return [{ text: word, highlight: false }]
  }
  const parts: WordSegment[] = []
  let i = 0
  while (i < word.length) {
    const idx = word.indexOf(kanji, i)
    if (idx === -1) {
      parts.push({ text: word.slice(i), highlight: false })
      break
    }
    if (idx > i) parts.push({ text: word.slice(i, idx), highlight: false })
    parts.push({ text: kanji, highlight: true })
    i = idx + kanji.length
  }
  return parts
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="character ? `Kanji detail ${character}` : 'Kanji detail'"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/50"
        aria-label="Close"
        @click="close"
      />

      <div
        class="relative z-10 flex max-h-[min(90dvh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-default bg-default shadow-xl"
        @click.stop
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-default px-4 py-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-4">
              <p class="shrink-0 text-5xl font-bold leading-none text-highlighted">
                {{ character }}
              </p>
              <div
                v-if="headerMeanings || headerPrimaryReading"
                class="min-w-0"
              >
                <p
                  v-if="headerMeanings"
                  class="text-xl font-bold leading-tight text-highlighted"
                >
                  {{ headerMeanings }}
                </p>
                <p
                  v-if="headerPrimaryReading"
                  class="text-lg font-bold leading-tight text-highlighted"
                >
                  {{ headerPrimaryReading }}
                </p>
              </div>
            </div>
            <p
              v-if="detail?.local"
              class="mt-2 text-sm text-muted"
            >
              {{ schoolYearLabel(detail.local.schoolGrade, detail.local.inJoyoo) }}
              · JLPT {{ detail.local.jlptLevel ?? '—' }}
              <template v-if="detail.local.wkLevel != null">
                · WK level {{ detail.local.wkLevel }}
              </template>
              <template v-if="detail.local.strokes != null">
                · {{ detail.local.strokes }} strokes
              </template>
              <template v-if="detail.local.freqRank != null">
                · freq #{{ detail.local.freqRank }}
              </template>
              <template v-if="!detail.local.inWanikani && detail.local.inJoyoo">
                · Untracked (not in WaniKani)
              </template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UTooltip
              v-if="wanikaniLink"
              text="Open on WaniKani"
            >
              <UButton
                :to="wanikaniLink"
                target="_blank"
                rel="noopener noreferrer"
                color="neutral"
                variant="ghost"
                square
                aria-label="Open on WaniKani"
              >
                <img
                  src="/wk-button.png"
                  alt=""
                  class="size-5 object-contain"
                >
              </UButton>
            </UTooltip>
            <UTooltip text="Open on Jisho">
              <UButton
                :to="jishoLink"
                target="_blank"
                rel="noopener noreferrer"
                color="neutral"
                variant="ghost"
                square
                aria-label="Open on Jisho"
              >
                <img
                  src="/jisho-button.png"
                  alt=""
                  class="size-5 object-contain"
                >
              </UButton>
            </UTooltip>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              aria-label="Close"
              @click="close"
            />
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p
            v-if="pending"
            class="text-sm text-muted"
          >
            Loading…
          </p>
          <p
            v-else-if="loadError"
            class="text-sm text-error"
          >
            {{ loadError }}
          </p>

          <div
            v-else-if="detail"
            class="space-y-5"
          >
            <div class="flex items-start gap-4">
              <section
                v-if="detail.wanikani"
                class="min-w-0 flex-1 space-y-3"
              >
                <h2 class="text-sm font-semibold text-highlighted">
                  WaniKani
                </h2>

                <div
                  v-if="readingGroups(detail).length"
                  class="space-y-1"
                >
                  <h3 class="text-xs font-medium uppercase tracking-wide text-muted">
                    Readings
                  </h3>
                  <p
                    v-for="group in readingGroups(detail)"
                    :key="group.label"
                    class="text-sm"
                  >
                    <span class="text-muted">{{ group.label }}: </span>
                    <template
                      v-for="(reading, readingIdx) in group.readings"
                      :key="`${group.label}-${reading.reading}-${readingIdx}`"
                    >
                      <span v-if="readingIdx > 0"> · </span>
                      <span :class="reading.primary ? 'font-bold' : undefined">{{ reading.reading }}</span>
                    </template>
                  </p>
                </div>

                <div
                  v-if="detail.wanikani.components.length"
                  class="space-y-1"
                >
                  <h3 class="text-xs font-medium uppercase tracking-wide text-muted">
                    Radicals
                  </h3>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="comp in detail.wanikani.components"
                      :key="comp.subjectId"
                      class="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-1 text-sm"
                    >
                      <span class="font-semibold">{{ comp.characters ?? '?' }}</span>
                      <span
                        v-if="comp.meaning"
                        class="text-muted"
                      >{{ comp.meaning }}</span>
                    </span>
                  </div>
                </div>

                <div
                  v-if="detail.wanikani.visuallySimilar.length"
                  class="text-sm text-muted"
                >
                  Visually similar:
                  {{ detail.wanikani.visuallySimilar.join(' · ') }}
                </div>

                <p
                  v-if="detail.local && hasWkReviewStats(detail.local)"
                  class="text-xs text-muted"
                >
                  WK reviews — meaning {{ detail.local.meaningIncorrect ?? 0 }} wrong of
                  {{ wkMeaningAttempts(detail.local) }}, reading {{ detail.local.readingIncorrect ?? 0 }} wrong of
                  {{ wkReadingAttempts(detail.local) }}
                </p>
              </section>

              <div class="flex shrink-0 items-stretch gap-3">
                <aside
                  v-if="detail.local"
                  class="flex w-36 flex-col justify-center rounded-lg border border-default bg-elevated px-3 py-3 text-sm"
                >
                  <p class="leading-snug text-muted">
                    SRS Level
                    <span
                      class="mt-0.5 block font-semibold"
                      :class="srsValueColor ? undefined : 'text-highlighted'"
                      :style="srsValueColor ? { color: srsValueColor } : undefined"
                    >
                      {{ detail.local.srsAvg != null ? detail.local.srsAvg.toFixed(1) : '—' }}
                    </span>
                  </p>
                  <p class="mt-3 leading-snug text-muted">
                    Accuracy
                    <span
                      class="mt-0.5 block font-semibold"
                      :class="accuracyValueColor ? undefined : 'text-highlighted'"
                      :style="accuracyValueColor ? { color: accuracyValueColor } : undefined"
                    >
                      {{ formatAccuracy(detail.local.accuracyAvg, {
                        sources: detail.local.sources,
                        srsAvg: detail.local.srsAvg
                      }) }}
                    </span>
                  </p>
                </aside>

                <KanjiStrokeOrder
                  v-if="character"
                  :character="character"
                />
              </div>
            </div>

            <div
              v-if="detail.wanikani?.meaningMnemonicSegments.length || detail.wanikani?.readingMnemonicSegments.length"
              class="space-y-2 rounded-lg bg-elevated p-3 text-sm"
            >
              <p v-if="detail.wanikani.meaningMnemonicSegments.length">
                <span class="font-medium text-muted">Meaning mnemonic · </span>
                <template
                  v-for="(segment, segmentIdx) in detail.wanikani.meaningMnemonicSegments"
                  :key="`meaning-${segmentIdx}`"
                >
                  <a
                    v-if="segment.type === 'link'"
                    :href="segment.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                  >{{ segment.content }}</a>
                  <span
                    v-else-if="segment.type === 'reading'"
                    class="italic text-red-600 dark:text-red-400"
                  >{{ segment.content }}</span>
                  <template v-else>
                    {{ segment.content }}
                  </template>
                </template>
              </p>
              <p v-if="detail.wanikani.readingMnemonicSegments.length">
                <span class="font-medium text-muted">Reading mnemonic · </span>
                <template
                  v-for="(segment, segmentIdx) in detail.wanikani.readingMnemonicSegments"
                  :key="`reading-${segmentIdx}`"
                >
                  <a
                    v-if="segment.type === 'link'"
                    :href="segment.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                  >{{ segment.content }}</a>
                  <span
                    v-else-if="segment.type === 'reading'"
                    class="italic text-red-600 dark:text-red-400"
                  >{{ segment.content }}</span>
                  <template v-else>
                    {{ segment.content }}
                  </template>
                </template>
              </p>
            </div>

            <section
              v-if="exampleList(detail).length"
              class="space-y-2"
            >
              <h2 class="text-sm font-semibold text-highlighted">
                Example words
              </h2>
              <ul class="divide-y divide-default rounded-lg border border-default">
                <li
                  v-for="ex in exampleList(detail)"
                  :key="`${ex.source}-${ex.characters}`"
                  class="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div class="min-w-0">
                    <p class="font-semibold">
                      <template
                        v-for="(seg, segIdx) in wordSegments(ex.characters, character)"
                        :key="segIdx"
                      >
                        <span
                          v-if="seg.highlight"
                          class="text-red-600 dark:text-red-400"
                        >{{ seg.text }}</span>
                        <span v-else>{{ seg.text }}</span>
                      </template>
                      <span
                        v-if="ex.reading"
                        class="ml-2 font-normal text-muted"
                      >{{ ex.reading }}</span>
                    </p>
                    <p
                      v-if="ex.meanings.length"
                      class="text-muted"
                    >
                      {{ ex.meanings.join('; ') }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <UBadge
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    >
                      {{ sourceLabel(ex.source) }}
                    </UBadge>
                    <UButton
                      v-if="ex.url"
                      :to="ex.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      icon="i-lucide-external-link"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      aria-label="Open example"
                    />
                  </div>
                </li>
              </ul>
            </section>

            <p
              v-for="(warning, idx) in detail.warnings"
              :key="idx"
              class="text-xs text-muted"
            >
              {{ warning }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
