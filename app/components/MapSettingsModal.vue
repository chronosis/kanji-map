<script setup lang="ts">
import type { SecondaryColorPaint } from '../../shared/types/kanji'
import { SECONDARY_COLOR_PAINT_ITEMS } from '../../shared/utils/colors'
import {
  KANJI_FONT_STYLE_ITEMS,
  colorModeItemsForSources,
  coerceMapUiSettingsForSources,
  orderModeItemsForSources,
  type KanjiFontStyle
} from '../../shared/utils/map-settings'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  wanikaniConfigured?: boolean
}>()

const { kanjiFont, defaultOrder, defaultColorMode, secondaryColorPaint, settings } = useMapSettings()

const wanikaniConfigured = computed(() => props.wanikaniConfigured !== false)

const orderItems = computed(() => orderModeItemsForSources(wanikaniConfigured.value))
const colorItems = computed(() => colorModeItemsForSources(wanikaniConfigured.value))

/** Draft values so Cancel can discard; Save writes to the cookie. */
const draftFont = ref<KanjiFontStyle>(kanjiFont.value)
const draftOrder = ref(defaultOrder.value)
const draftColor = ref(defaultColorMode.value)
const draftSecondaryPaint = ref<SecondaryColorPaint>(secondaryColorPaint.value)

watch(open, (isOpen) => {
  if (!isOpen) return
  const coerced = coerceMapUiSettingsForSources(settings.value, wanikaniConfigured.value)
  draftFont.value = coerced.kanjiFont
  draftOrder.value = coerced.defaultOrder
  draftColor.value = coerced.defaultColorMode
  draftSecondaryPaint.value = coerced.secondaryColorPaint
})

watch(wanikaniConfigured, (configured) => {
  if (configured) return
  const coerced = coerceMapUiSettingsForSources({
    kanjiFont: draftFont.value,
    defaultOrder: draftOrder.value,
    defaultColorMode: draftColor.value,
    secondaryColorPaint: draftSecondaryPaint.value
  }, false)
  draftOrder.value = coerced.defaultOrder
  draftColor.value = coerced.defaultColorMode
})

function save() {
  const next = coerceMapUiSettingsForSources({
    kanjiFont: draftFont.value,
    defaultOrder: draftOrder.value,
    defaultColorMode: draftColor.value,
    secondaryColorPaint: draftSecondaryPaint.value
  }, wanikaniConfigured.value)
  settings.value = next
  open.value = false
}

function cancel() {
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Settings"
    :ui="{
      content: 'sm:max-w-lg'
    }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="flex items-start gap-5">
          <div class="min-w-0 flex-1 space-y-4">
            <UFormField label="Kanji font">
              <USelect
                v-model="draftFont"
                :items="[...KANJI_FONT_STYLE_ITEMS]"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Default order">
              <USelect
                v-model="draftOrder"
                :items="orderItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Default color mode">
              <USelect
                v-model="draftColor"
                :items="colorItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Secondary color mode">
              <USelect
                v-model="draftSecondaryPaint"
                :items="[...SECONDARY_COLOR_PAINT_ITEMS]"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex w-28 shrink-0 flex-col items-center gap-2">
            <p class="text-xs font-medium text-muted">
              Preview
            </p>
            <div
              class="flex size-24 items-center justify-center rounded-lg border border-default bg-elevated"
              :data-kanji-font="draftFont"
            >
              <span class="km-kanji select-none text-6xl leading-none text-highlighted">
                字
              </span>
            </div>
            <p class="text-center text-xs text-muted">
              {{ KANJI_FONT_STYLE_ITEMS.find(i => i.value === draftFont)?.label }}
            </p>
          </div>
        </div>

        <p class="text-xs text-muted">
          Preferences are saved in a browser cookie and apply on this device.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          @click="cancel"
        />
        <UButton
          label="Save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
