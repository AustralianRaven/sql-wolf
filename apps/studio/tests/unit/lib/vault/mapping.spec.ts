import { applyFieldMappings, normalizeFieldMappings } from '@/lib/vault/mapping'
import { VAULT_FIELD_KEYS } from '@/lib/vault/types'

describe('vault field mappings', () => {

  describe('applyFieldMappings', () => {
    it('uses the field name as the key when a mapping is blank', () => {
      const merged = { host: 'db.example.com', port: '5432' }
      expect(applyFieldMappings(merged, {})).toEqual([
        { field: 'host', vaultKey: 'host', value: 'db.example.com' },
        { field: 'port', vaultKey: 'port', value: '5432' },
      ])
    })

    it('reads the configured vault key when a mapping is set', () => {
      const merged = { DB_HOST: 'db.example.com' }
      expect(applyFieldMappings(merged, { host: 'DB_HOST' })).toEqual([
        { field: 'host', vaultKey: 'DB_HOST', value: 'db.example.com' },
      ])
    })

    it('ignores whitespace around a configured key', () => {
      const merged = { DB_HOST: 'db.example.com' }
      expect(applyFieldMappings(merged, { host: '  DB_HOST  ' })[0].value).toBe('db.example.com')
    })

    it('skips fields the merged values do not cover', () => {
      const mapped = applyFieldMappings({ host: 'only-host' }, {})
      expect(mapped.map((m) => m.field)).toEqual(['host'])
    })

    it('returns nothing when no key matches', () => {
      expect(applyFieldMappings({ SOMETHING_ELSE: 'x' }, {})).toEqual([])
    })

    it('emits fields in the declared field order, not vault key order', () => {
      const merged = { sshPassword: 'a', host: 'b', password: 'c' }
      expect(applyFieldMappings(merged, {}).map((m) => m.field))
        .toEqual(['host', 'password', 'sshPassword'])
    })
  })

  describe('normalizeFieldMappings', () => {
    it('fills every field with a blank default', () => {
      const normalized = normalizeFieldMappings()
      expect(Object.keys(normalized).sort()).toEqual([...VAULT_FIELD_KEYS].sort())
      expect(Object.values(normalized).every((v) => v === '')).toBe(true)
    })

    it('keeps the values that were supplied', () => {
      expect(normalizeFieldMappings({ host: 'DB_HOST' }).host).toBe('DB_HOST')
    })
  })
})
