import { describe, expect, it } from 'vitest'
import { alertFromSyncError, alertsFromSyncResult } from '../shared/utils/map-alerts'

describe('map-alerts', () => {
  it('builds a summary alert and one alert per warning', () => {
    const alerts = alertsFromSyncResult({
      wanikani: 2102,
      bunpro: 0,
      merged: 2049,
      warnings: [
        'BunPro frontend_api_token rejected — copy a fresh value',
        '   '
      ]
    }, 1000)

    expect(alerts.map(alert => alert.title)).toEqual(['Sync complete', 'Sync warning'])
    expect(alerts[0]?.body).toBe('Synced WK 2102, BunPro 0, merged 2049')
    expect(alerts[1]?.body).toContain('frontend_api_token')
    expect(alerts.every(alert => !alert.read)).toBe(true)
  })

  it('builds an error alert from a failed sync', () => {
    expect(alertFromSyncError('network down', 5)).toMatchObject({
      id: '5-error',
      level: 'error',
      title: 'Sync failed',
      body: 'network down'
    })
  })
})
