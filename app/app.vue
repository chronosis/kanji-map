<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'Kanji Map',
  description: 'Mastery map of Japanese school + JLPT kanji'
})

const { syncing, runSync } = useApiSync()
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
          <NuxtLink
            to="/"
            class="flex items-center gap-2 font-semibold text-highlighted"
          >
            <AppLogo class="h-9 w-9 shrink-0" />
            <span>Kanji Map</span>
          </NuxtLink>
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              :loading="syncing"
              size="sm"
              @click="runSync"
            >
              Sync APIs
            </UButton>
            <UColorModeButton />
          </div>
        </template>
      </UHeader>

      <UMain class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <NuxtPage />
        </div>
      </UMain>
    </div>
  </UApp>
</template>
