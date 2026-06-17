import { describe, it, expect } from 'vitest'
import { LEARN_MODULES } from './learnModules'

const EXPECTED_TITLES = [
  'What are crypto whales?',
  'Why whale movements predict price',
  'Reading on-chain data',
  'How to act on a signal safely',
  'Risk management basics',
  'Understanding confidence scores',
]

describe('LEARN_MODULES', () => {
  it('exports exactly 6 modules', () => {
    expect(LEARN_MODULES).toHaveLength(6)
  })

  it('module titles match the spec list exactly (in order)', () => {
    const titles = LEARN_MODULES.map((m) => m.title)
    expect(titles).toEqual(EXPECTED_TITLES)
  })

  it('each module has 3–5 screens', () => {
    for (const mod of LEARN_MODULES) {
      expect(mod.screens.length).toBeGreaterThanOrEqual(3)
      expect(mod.screens.length).toBeLessThanOrEqual(5)
    }
  })

  it('each module declares an unlocksFeature string', () => {
    for (const mod of LEARN_MODULES) {
      expect(typeof mod.unlocksFeature).toBe('string')
      expect(mod.unlocksFeature.length).toBeGreaterThan(0)
    }
  })

  it('module ids are 1..6 and all unique', () => {
    const ids = LEARN_MODULES.map((m) => m.id)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(ids).size).toBe(6)
  })

  it('each screen has a non-empty title and body', () => {
    for (const mod of LEARN_MODULES) {
      for (const screen of mod.screens) {
        expect(typeof screen.title).toBe('string')
        expect(screen.title.length).toBeGreaterThan(0)
        expect(typeof screen.body).toBe('string')
        expect(screen.body.length).toBeGreaterThan(0)
      }
    }
  })

  it('unlocksFeature values match spec keys', () => {
    const expectedFeatures = [
      'whale_heatmap',
      'signal_history',
      'price_alerts',
      'share_signal',
      'risk_calculator',
      'confidence_filter',
    ]
    const actualFeatures = LEARN_MODULES.map((m) => m.unlocksFeature)
    expect(actualFeatures).toEqual(expectedFeatures)
  })
})
