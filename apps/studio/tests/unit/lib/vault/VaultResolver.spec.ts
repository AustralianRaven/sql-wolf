import { resolveSecretRefs } from '@/lib/vault/VaultResolver'
import { buildVaultProvider } from '@/lib/vault/registry'
import { VaultProviderConfig } from '@/lib/vault/types'

jest.mock('@/lib/vault/registry', () => ({
  buildVaultProvider: jest.fn(),
}))

const mockedBuild = buildVaultProvider as jest.MockedFunction<typeof buildVaultProvider>

function provider(name: string): VaultProviderConfig {
  return {
    name,
    providerType: 'azure-key-vault',
    vaultUrl: `https://${name}.vault.azure.net/`,
    tenantId: 'tenant',
    clientId: 'client',
    clientSecret: 'secret',
  }
}

/**
 * Wires the mocked registry so each vault answers from a fixed map of
 * secretName -> variables. A missing secret throws, as a real vault would.
 */
function withVaults(vaults: Record<string, Record<string, Record<string, string>>>) {
  mockedBuild.mockImplementation((config) => ({
    testConnection: jest.fn(),
    fetchSecret: jest.fn(async (secretName: string) => {
      const secrets = vaults[config.name]
      if (!secrets || !secrets[secretName]) {
        throw new Error(`Secret '${secretName}' not found in '${config.name}'`)
      }
      return secrets[secretName]
    }),
  }))
}

beforeEach(() => {
  mockedBuild.mockReset()
})

describe('resolveSecretRefs', () => {

  describe('given several tiers define the same key', () => {
    beforeEach(() => {
      withVaults({
        Qa: {
          'devau--qa-a-sa': { username: 'tenant-user', password: 'tenant-pass' },
          devau: { username: 'cluster-user', host: 'cluster-host' },
        },
        Shared: {
          global: { host: 'global-host', port: '5432' },
        },
      })
    })

    const refs = [
      { vaultName: 'Qa', secretName: 'devau--qa-a-sa' },
      { vaultName: 'Qa', secretName: 'devau' },
      { vaultName: 'Shared', secretName: 'global' },
    ]

    it('the first ref to define a key keeps it', async () => {
      const { merged } = await resolveSecretRefs(refs, [provider('Qa'), provider('Shared')])
      expect(merged).toEqual({
        username: 'tenant-user',
        password: 'tenant-pass',
        host: 'cluster-host',
        port: '5432',
      })
    })

    it('records which secret supplied each key', async () => {
      const { owner } = await resolveSecretRefs(refs, [provider('Qa'), provider('Shared')])
      expect(owner.username).toBe('devau--qa-a-sa')
      expect(owner.host).toBe('devau')
      expect(owner.port).toBe('global')
    })

    it('reports the shadowed keys rather than dropping them silently', async () => {
      const { conflicts } = await resolveSecretRefs(refs, [provider('Qa'), provider('Shared')])
      expect(conflicts).toEqual([
        { key: 'username', winner: 'devau--qa-a-sa', shadowedBy: ['devau'] },
        { key: 'host', winner: 'devau', shadowedBy: ['global'] },
      ])
    })

    it('returns one source per ref, in ref order', async () => {
      const { sources } = await resolveSecretRefs(refs, [provider('Qa'), provider('Shared')])
      expect(sources.map((s) => s.secretName)).toEqual(['devau--qa-a-sa', 'devau', 'global'])
    })
  })

  describe('given a ref pins no vault', () => {
    it('tries each provider in order and the first success wins', async () => {
      withVaults({
        First: {},
        Second: { global: { host: 'from-second' } },
      })

      const { merged, sources } = await resolveSecretRefs(
        [{ vaultName: '', secretName: 'global' }],
        [provider('First'), provider('Second')]
      )

      expect(merged).toEqual({ host: 'from-second' })
      expect(sources[0].vaultName).toBe('Second')
    })

    it('reports an error when no provider holds the secret', async () => {
      withVaults({ Only: {} })

      const { sources, merged } = await resolveSecretRefs(
        [{ vaultName: '', secretName: 'missing' }],
        [provider('Only')]
      )

      expect(merged).toEqual({})
      expect(sources[0].error).toContain('missing')
    })

    it('reports an error when no vault is configured at all', async () => {
      const { sources } = await resolveSecretRefs([{ vaultName: '', secretName: 'global' }], [])
      expect(sources[0].error).toBe('No vault is configured')
    })
  })

  describe('given a ref pins a vault that is not configured', () => {
    it('fails loudly instead of falling back to another vault', async () => {
      withVaults({ Other: { global: { host: 'wrong-environment' } } })

      const { sources, merged } = await resolveSecretRefs(
        [{ vaultName: 'Missing Vault', secretName: 'global' }],
        [provider('Other')]
      )

      expect(sources[0].error).toBe("Vault 'Missing Vault' is not configured")
      expect(merged).toEqual({})
      expect(mockedBuild).not.toHaveBeenCalled()
    })
  })

  describe('given one vault is unreachable', () => {
    it('degrades only that tier and still resolves the rest', async () => {
      withVaults({
        Broken: {},
        Working: { global: { host: 'still-here', port: '5432' } },
      })

      const { merged, sources } = await resolveSecretRefs(
        [
          { vaultName: 'Broken', secretName: 'devau' },
          { vaultName: 'Working', secretName: 'global' },
        ],
        [provider('Broken'), provider('Working')]
      )

      expect(merged).toEqual({ host: 'still-here', port: '5432' })
      expect(sources[0].error).toBeTruthy()
      expect(sources[1].error).toBeNull()
    })
  })

  it('returns empty results for an empty ref list', async () => {
    const result = await resolveSecretRefs([], [provider('Qa')])
    expect(result).toEqual({ sources: [], merged: {}, owner: {}, conflicts: [] })
  })
})
