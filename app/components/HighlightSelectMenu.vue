<script setup lang="ts">
import type { SelectMenuItem } from '@nuxt/ui'
import {
  buildCollapsibleHighlightMenuItems,
  defaultHighlightCollapsedCategories,
  type HighlightCategoryId,
  type HighlightCollapsedCategories,
  type HighlightOptionValue
} from '../../shared/utils/map-highlight'

const selection = defineModel<Array<{ label: string, value: HighlightOptionValue }>>({
  required: true
})

const props = defineProps<{
  includeSrs?: boolean
  includeWkLevels?: boolean
}>()

const searchTerm = ref('')
const collapsed = ref<HighlightCollapsedCategories>(defaultHighlightCollapsedCategories())

const effectiveCollapsed = computed((): HighlightCollapsedCategories => {
  if (searchTerm.value.trim()) {
    return { year: false, jlpt: false, srs: false, wk: false }
  }
  return collapsed.value
})

function toggleCategory(category: HighlightCategoryId) {
  collapsed.value = {
    ...collapsed.value,
    [category]: !collapsed.value[category]
  }
}

const menuItems = computed((): SelectMenuItem[][] => {
  const sections = buildCollapsibleHighlightMenuItems({
    includeSrs: props.includeSrs,
    includeWkLevels: props.includeWkLevels,
    collapsed: effectiveCollapsed.value
  })

  return sections.map(group => group.map((item): SelectMenuItem => {
    if ('isCategoryHeader' in item && item.isCategoryHeader) {
      return {
        label: item.label,
        value: item.value,
        icon: item.icon,
        class: 'font-semibold text-highlighted',
        onSelect: (event: Event) => {
          event.preventDefault()
          toggleCategory(item.category)
        }
      }
    }
    return item
  }))
})
</script>

<template>
  <USelectMenu
    v-model="selection"
    v-model:search-term="searchTerm"
    multiple
    by="value"
    :items="menuItems"
    :search-input="{ placeholder: 'Filter highlights…' }"
    placeholder="None"
    class="w-72"
  />
</template>
