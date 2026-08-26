import {
  connectionSecretRefs,
  parseVaultSecretRef,
  parseVaultSecretRefs,
  serializeVaultSecretRefs,
} from '@/lib/vault/refs'

describe('vault secret refs', () => {

  describe('parseVaultSecretRef', () => {
    it.each([
      ['a bare secret name means any vault', 'devau', { vaultName: '', secretName: 'devau' }],
      ['a pinned vault splits on the colon', 'Qa Vault:devau', { vaultName: 'Qa Vault', secretName: 'devau' }],
      ['surrounding whitespace is trimmed', '  Qa Vault : devau  ', { vaultName: 'Qa Vault', secretName: 'devau' }],
      ['a hyphenated secret name survives', 'Qa:devau--qa-a-sa', { vaultName: 'Qa', secretName: 'devau--qa-a-sa' }],
    ])('%s', (_title, input, expected) => {
      expect(parseVaultSecretRef(input as string)).toEqual(expected)
    })

    it('splits on the LAST colon so a vault name may contain one', () => {
      expect(parseVaultSecretRef('Prod: EU:orders-db')).toEqual({
        vaultName: 'Prod: EU',
        secretName: 'orders-db',
      })
    })

    it.each([
      ['an empty string', ''],
      ['whitespace only', '   '],
      ['a trailing colon with no secret name', 'Qa Vault:'],
    ])('returns null for %s', (_title, input) => {
      expect(parseVaultSecretRef(input as string)).toBeNull()
    })
  })

  describe('parseVaultSecretRefs', () => {
    it('keeps the given order, which is tier precedence', () => {
      const refs = parseVaultSecretRefs('Qa:devau--qa-a-sa,Qa:devau,Shared:global')
      expect(refs.map((r) => r.secretName)).toEqual(['devau--qa-a-sa', 'devau', 'global'])
    })

    it('mixes pinned and unpinned entries', () => {
      expect(parseVaultSecretRefs('Qa:devau,global')).toEqual([
        { vaultName: 'Qa', secretName: 'devau' },
        { vaultName: '', secretName: 'global' },
      ])
    })

    it('drops empty entries rather than producing blank refs', () => {
      expect(parseVaultSecretRefs('Qa:devau,,  ,global')).toHaveLength(2)
    })

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
    ])('returns an empty list for %s', (_title, input) => {
      expect(parseVaultSecretRefs(input as string | null)).toEqual([])
    })
  })

  describe('serializeVaultSecretRefs', () => {
    it('round-trips a parsed list unchanged', () => {
      const raw = 'Qa Vault:devau--qa-a-sa,Qa Vault:devau,global'
      expect(serializeVaultSecretRefs(parseVaultSecretRefs(raw))).toBe(raw)
    })

    it('omits the vault name for an unpinned ref', () => {
      expect(serializeVaultSecretRefs([{ vaultName: '', secretName: 'global' }])).toBe('global')
    })

    it('skips rows with no secret name, so a blank UI row saves nothing', () => {
      const refs = [
        { vaultName: 'Qa', secretName: 'devau' },
        { vaultName: 'Qa', secretName: '' },
      ]
      expect(serializeVaultSecretRefs(refs)).toBe('Qa:devau')
    })
  })

  describe('connectionSecretRefs', () => {
    it('prefers the multi-vault field when it is set', () => {
      const refs = connectionSecretRefs({
        vaultSecretRefs: 'Qa:devau,global',
        vaultSecretName: 'legacy-secret',
      })
      expect(refs.map((r) => r.secretName)).toEqual(['devau', 'global'])
    })

    it('falls back to the legacy single-secret field', () => {
      const refs = connectionSecretRefs({ vaultSecretName: 'legacy-secret' })
      expect(refs).toEqual([{ vaultName: '', secretName: 'legacy-secret' }])
    })

    it('returns nothing when neither field is set', () => {
      expect(connectionSecretRefs({})).toEqual([])
    })
  })
})
