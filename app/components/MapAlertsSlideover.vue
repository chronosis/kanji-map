<script setup lang="ts">
import type { MapAlertLevel } from '../../shared/utils/map-alerts'

const {
  alerts,
  alertsOpen,
  selectedAlert,
  selectedAlertId
} = useApiSync()

const detailOpen = computed({
  get: () => selectedAlertId.value != null,
  set: (open: boolean) => {
    if (!open) selectedAlertId.value = null
  }
})

const levelIcon: Record<MapAlertLevel, string> = {
  info: 'i-lucide-info',
  warning: 'i-lucide-triangle-alert',
  error: 'i-lucide-circle-x'
}

const levelClass: Record<MapAlertLevel, string> = {
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-error'
}

function formatWhen(createdAt: number): string {
  return new Date(createdAt).toLocaleString()
}

function openAlert(id: string) {
  selectedAlertId.value = id
}
</script>

<template>
  <USlideover
    v-model:open="alertsOpen"
    title="Alerts"
    description="Sync status and warnings"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <p
        v-if="alerts.length === 0"
        class="text-sm text-muted"
      >
        No alerts yet. Sync status and warnings show up here.
      </p>
      <ul
        v-else
        class="flex flex-col gap-2"
      >
        <li
          v-for="alert in alerts"
          :key="alert.id"
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left ring ring-default hover:bg-elevated"
            @click="openAlert(alert.id)"
          >
            <UIcon
              :name="levelIcon[alert.level]"
              class="mt-0.5 size-4 shrink-0"
              :class="levelClass[alert.level]"
            />
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-3">
                <span class="font-medium text-highlighted">{{ alert.title }}</span>
                <span class="shrink-0 text-xs text-muted">{{ formatWhen(alert.createdAt) }}</span>
              </span>
              <span class="mt-1 line-clamp-2 text-sm text-muted">{{ alert.body }}</span>
            </span>
          </button>
        </li>
      </ul>
    </template>
  </USlideover>

  <UModal
    v-model:open="detailOpen"
    :title="selectedAlert?.title ?? 'Alert'"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div
        v-if="selectedAlert"
        class="space-y-3"
      >
        <p class="text-xs text-muted">
          {{ formatWhen(selectedAlert.createdAt) }}
        </p>
        <p class="whitespace-pre-wrap text-sm text-default">
          {{ selectedAlert.body }}
        </p>
      </div>
    </template>
  </UModal>
</template>
