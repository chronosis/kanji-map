<script setup lang="ts">
import { formatSnapshotTimestamp } from '../shared/utils/map-snapshot'

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400&family=Noto+Serif+JP:wght@400&family=Yuji+Syuku&display=swap'
    }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'Kanji Map',
  description: 'Mastery map of Japanese school + JLPT kanji'
})

const { syncing, syncStatus, runSync, alertsOpen, unreadCount } = useApiSync()
useMapSettings()
const sourcesFetch = useFetch<{
  wanikani: boolean
  bunpro: boolean
}>('/api/sources')
const {
  activeSnapshot,
  atOldest,
  atNewest,
  stepping,
  stepSnapshot
} = await useMapTimeline()
await sourcesFetch
const sourcesConfigured = sourcesFetch.data

const settingsOpen = ref(false)
</script>

<template>
  <!-- UApp drops classes on its root; keep shell layout on this wrapper. -->
  <UApp>
    <div class="flex h-dvh flex-col overflow-hidden">
      <UHeader
        title="Kanji Map"
        class="shrink-0"
        :ui="{
          container: 'max-w-none w-full'
        }"
      >
        <template #left>
          <div class="flex min-w-0 items-center gap-3">
            <NuxtLink
              to="/"
              class="flex items-center gap-2 font-semibold text-highlighted"
            >
              <AppLogo class="h-10 w-10 shrink-0" />
              <span>Kanji Map</span>
            </NuxtLink>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="soft"
                size="sm"
                square
                aria-label="Earlier snapshot"
                :disabled="atOldest || stepping || syncing"
                @click="stepSnapshot(-1)"
              />
              <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="soft"
                size="sm"
                square
                aria-label="Later snapshot"
                :disabled="atNewest || stepping || syncing"
                @click="stepSnapshot(1)"
              />
              <time
                v-if="activeSnapshot"
                :datetime="activeSnapshot.capturedAt"
                class="truncate ps-1 text-sm whitespace-nowrap text-muted"
              >
                {{ formatSnapshotTimestamp(activeSnapshot.capturedAt) }}
              </time>
            </div>
          </div>
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <p
              v-if="syncing"
              class="max-w-[14rem] text-right text-sm leading-snug text-muted sm:max-w-xs"
              role="status"
              aria-live="polite"
            >
              {{ syncStatus || 'Syncing…' }}
            </p>
            <UButton
              icon="i-lucide-refresh-cw"
              :loading="syncing"
              size="sm"
              @click="runSync"
            >
              Sync APIs
            </UButton>
            <UColorModeButton />
            <UChip
              :text="unreadCount > 99 ? '99+' : unreadCount"
              :show="unreadCount > 0"
              color="error"
              size="3xl"
            >
              <UTooltip text="Alerts">
                <UButton
                  icon="i-lucide-bell"
                  color="neutral"
                  variant="ghost"
                  square
                  aria-label="Alerts"
                  @click="alertsOpen = true"
                />
              </UTooltip>
            </UChip>
            <UTooltip text="Settings">
              <UButton
                icon="i-lucide-settings"
                color="neutral"
                variant="ghost"
                square
                aria-label="Settings"
                @click="settingsOpen = true"
              />
            </UTooltip>
          </div>
        </template>
      </UHeader>

      <UMain class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NuxtPage />
        </div>
      </UMain>

      <MapSettingsModal
        v-model:open="settingsOpen"
        :wanikani-configured="Boolean(sourcesConfigured?.wanikani)"
      />
      <MapAlertsSlideover />
    </div>
  </UApp>
</template>
