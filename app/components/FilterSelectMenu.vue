<script setup lang="ts">
import type { MapFilterId } from '../../shared/types/kanji'
import { MAP_FILTER_ITEMS } from '../../shared/utils/colors'

const selection = defineModel<Array<{ label: string, value: MapFilterId }>>({
  required: true
})
</script>

<template>
  <USelectMenu
    v-model="selection"
    multiple
    by="value"
    :items="[...MAP_FILTER_ITEMS]"
    placeholder="None"
    class="w-72"
  />
</template>
