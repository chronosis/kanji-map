export type MapAlertLevel = 'info' | 'warning' | 'error'

export interface MapAlert {
  id: string
  level: MapAlertLevel
  title: string
  body: string
  createdAt: number
  read: boolean
}

export interface SyncAlertSource {
  wanikani: number
  bunpro: number
  merged: number
  warnings?: string[]
}

export function alertsFromSyncResult(result: SyncAlertSource, now = Date.now()): MapAlert[] {
  const alerts: MapAlert[] = [{
    id: `${now}-summary`,
    level: 'info',
    title: 'Sync complete',
    body: `Synced WK ${result.wanikani}, BunPro ${result.bunpro}, merged ${result.merged}`,
    createdAt: now,
    read: false
  }]

  for (const [index, warning] of (result.warnings ?? []).entries()) {
    const body = warning.trim()
    if (!body) continue
    alerts.push({
      id: `${now}-warning-${index}`,
      level: 'warning',
      title: 'Sync warning',
      body,
      createdAt: now,
      read: false
    })
  }

  return alerts
}

export function alertFromSyncError(message: string, now = Date.now()): MapAlert {
  return {
    id: `${now}-error`,
    level: 'error',
    title: 'Sync failed',
    body: message.trim() || 'Sync failed',
    createdAt: now,
    read: false
  }
}
