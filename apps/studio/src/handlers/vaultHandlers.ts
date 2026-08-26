import { VaultProvider as VaultProviderEntity } from '@/common/appdb/models/VaultProvider'
import { buildVaultProvider } from '@/lib/vault/registry'
import { resolveSecretRefs } from '@/lib/vault/VaultResolver'
import { applyFieldMappings, MappedVaultField } from '@/lib/vault/mapping'
import {
  SafeVaultProvider, VaultFieldMappings, VaultProviderConfig, VaultProviderType,
  VaultResolution, VaultSecretRef, VaultTestResult
} from '@/lib/vault/types'
import rawLog from '@bksLogger'

const log = rawLog.scope('vaultHandlers')

/** What the renderer sends when adding or editing a vault. */
export interface VaultProviderInput {
  id?: number
  name: string
  providerType: VaultProviderType
  vaultUrl: string
  tenantId: string
  clientId: string
  /** Blank on edit means "keep the stored secret", not "erase it". */
  clientSecret?: string
}

export interface VaultResolveResult {
  resolution: VaultResolution
  mapped: MappedVaultField[]
}

/**
 * Strip the credential before anything crosses back to the renderer. The
 * renderer needs to know a secret EXISTS so it can render the form; it never
 * needs the secret itself.
 */
function toSafe(entity: VaultProviderEntity): SafeVaultProvider {
  return {
    id: entity.id,
    name: entity.name,
    providerType: entity.providerType,
    vaultUrl: entity.vaultUrl ?? '',
    tenantId: entity.tenantId ?? '',
    clientId: entity.clientId ?? '',
    hasClientSecret: Boolean(entity.clientSecret),
    position: entity.position ?? 0,
  }
}

/** Ordered by the fallback order set in Settings, then by id for stability. */
async function orderedEntities(): Promise<VaultProviderEntity[]> {
  return await VaultProviderEntity.find({ order: { position: 'ASC', id: 'ASC' } })
}

/** Decrypts. Utility process only — never expose the result to the renderer. */
async function resolveConfigs(): Promise<VaultProviderConfig[]> {
  const entities = await orderedEntities()
  return entities.map((e) => ({
    id: e.id,
    name: e.name,
    providerType: e.providerType,
    vaultUrl: e.vaultUrl ?? '',
    tenantId: e.tenantId ?? '',
    clientId: e.clientId ?? '',
    clientSecret: e.clientSecret ?? '',
  }))
}

function assertName(name: string) {
  if (!name?.trim()) {
    throw new Error('A vault needs a name. The name is what a connection pins to.')
  }
  if (name.includes(',')) {
    throw new Error("A vault name cannot contain a comma — it separates secret refs.")
  }
}

export interface IVaultHandlers {
  'vault/providers/list': () => Promise<SafeVaultProvider[]>
  'vault/providers/add': (args: { provider: VaultProviderInput }) => Promise<SafeVaultProvider>
  'vault/providers/update': (args: { provider: VaultProviderInput }) => Promise<SafeVaultProvider>
  'vault/providers/remove': (args: { id: number }) => Promise<void>
  'vault/providers/reorder': (args: { ids: number[] }) => Promise<SafeVaultProvider[]>
  'vault/providers/test': (args: { provider: VaultProviderInput }) => Promise<VaultTestResult>
  'vault/resolve': (args: {
    refs: VaultSecretRef[]
    mappings?: Partial<VaultFieldMappings>
  }) => Promise<VaultResolveResult>
}

export const VaultHandlers: IVaultHandlers = {

  'vault/providers/list': async function () {
    return (await orderedEntities()).map(toSafe)
  },

  'vault/providers/add': async function ({ provider }) {
    assertName(provider.name)

    const existing = await VaultProviderEntity.findOneBy({ name: provider.name.trim() })
    if (existing) {
      throw new Error(`A vault called '${provider.name.trim()}' already exists`)
    }

    const count = await VaultProviderEntity.count()
    const entity = new VaultProviderEntity().withProps({
      name: provider.name.trim(),
      providerType: provider.providerType ?? 'azure-key-vault',
      vaultUrl: provider.vaultUrl ?? null,
      tenantId: provider.tenantId ?? null,
      clientId: provider.clientId ?? null,
      clientSecret: provider.clientSecret || null,
      position: count,
    })
    await entity.save()
    return toSafe(entity)
  },

  'vault/providers/update': async function ({ provider }) {
    assertName(provider.name)

    const entity = await VaultProviderEntity.findOneBy({ id: provider.id })
    if (!entity) throw new Error('That vault no longer exists')

    const clash = await VaultProviderEntity.findOneBy({ name: provider.name.trim() })
    if (clash && clash.id !== entity.id) {
      throw new Error(`A vault called '${provider.name.trim()}' already exists`)
    }

    entity.name = provider.name.trim()
    entity.providerType = provider.providerType ?? entity.providerType
    entity.vaultUrl = provider.vaultUrl ?? null
    entity.tenantId = provider.tenantId ?? null
    entity.clientId = provider.clientId ?? null
    // The edit form cannot display the stored secret, so a plain merge would
    // wipe it on every save. Blank means unchanged.
    if (provider.clientSecret) entity.clientSecret = provider.clientSecret

    await entity.save()
    return toSafe(entity)
  },

  'vault/providers/remove': async function ({ id }) {
    const entity = await VaultProviderEntity.findOneBy({ id })
    if (entity) await entity.remove()
  },

  'vault/providers/reorder': async function ({ ids }) {
    // Order is the fallback order for unpinned refs, so this is a real setting,
    // not a cosmetic one.
    await Promise.all(ids.map(async (id, position) => {
      const entity = await VaultProviderEntity.findOneBy({ id })
      if (!entity) return
      entity.position = position
      await entity.save()
    }))
    return (await orderedEntities()).map(toSafe)
  },

  'vault/providers/test': async function ({ provider }) {
    try {
      let clientSecret = provider.clientSecret ?? ''

      // Testing an existing vault without retyping the secret: fetch the stored one.
      if (!clientSecret && provider.id) {
        const entity = await VaultProviderEntity.findOneBy({ id: provider.id })
        clientSecret = entity?.clientSecret ?? ''
      }

      return await buildVaultProvider({
        name: provider.name,
        providerType: provider.providerType ?? 'azure-key-vault',
        vaultUrl: provider.vaultUrl,
        tenantId: provider.tenantId,
        clientId: provider.clientId,
        clientSecret,
      }).testConnection()
    } catch (e) {
      log.error('Vault test failed:', e)
      return { success: false, error: e?.message ?? String(e) }
    }
  },

  'vault/resolve': async function ({ refs, mappings }) {
    const resolution = await resolveSecretRefs(refs ?? [], await resolveConfigs())
    return { resolution, mapped: applyFieldMappings(resolution.merged, mappings) }
  },
}
