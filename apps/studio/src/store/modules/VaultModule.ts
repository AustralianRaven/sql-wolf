import Vue from 'vue'
import { normalizeFieldMappings } from '@/lib/vault/mapping'
import {
  SafeVaultProvider, VaultFieldMappings, VaultFieldKey, VaultSecretRef
} from '@/lib/vault/types'
import type { VaultProviderInput, VaultResolveResult } from '@/handlers/vaultHandlers'

const MAPPINGS_KEY = 'vault_field_mappings'
/** The pre-multi-vault single-vault blob. Read once, then migrated. */
const LEGACY_CONFIG_KEY = 'azure_vault_config'

interface VaultState {
  providers: SafeVaultProvider[]
  fieldMappings: VaultFieldMappings
  loaded: boolean
}

async function readSetting(key: string): Promise<any> {
  try {
    const raw = await Vue.prototype.$util.send('appdb/setting/get', { key })
    if (!raw?.value) return null
    return typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value
  } catch {
    return null
  }
}

export const VaultModule = {
  namespaced: true,

  state(): VaultState {
    return {
      providers: [],
      fieldMappings: normalizeFieldMappings(),
      loaded: false,
    }
  },

  getters: {
    providers: (state: VaultState) => state.providers,
    providerNames: (state: VaultState) => state.providers.map((p) => p.name),
    fieldMappings: (state: VaultState) => state.fieldMappings,
    /** The connection form shows the vault panel only once a vault exists. */
    enabled: (state: VaultState) => state.providers.length > 0,
  },

  mutations: {
    setProviders(state: VaultState, providers: SafeVaultProvider[]) {
      state.providers = providers
    },
    setFieldMappings(state: VaultState, mappings: Partial<VaultFieldMappings>) {
      state.fieldMappings = normalizeFieldMappings(mappings)
    },
    setLoaded(state: VaultState) {
      state.loaded = true
    },
  },

  actions: {
    async load(context: any) {
      await context.dispatch('refreshProviders')

      const saved = await readSetting(MAPPINGS_KEY)
      if (saved) {
        context.commit('setFieldMappings', saved)
      } else {
        await context.dispatch('migrateLegacyConfig')
      }

      context.commit('setLoaded')
    },

    /**
     * Carry the old single-vault settings blob forward: its mappings become the
     * global mappings, and its connection details become the first vault. Runs
     * once — after this the mappings setting exists and the branch is skipped.
     */
    async migrateLegacyConfig(context: any) {
      const legacy = await readSetting(LEGACY_CONFIG_KEY)
      if (!legacy) return

      if (legacy.fieldMappings) {
        await context.dispatch('saveFieldMappings', legacy.fieldMappings)
      }

      const hasDetails = legacy.vaultUrl && legacy.tenantId && legacy.clientId
      if (!hasDetails || context.state.providers.length > 0) return

      try {
        await context.dispatch('addProvider', {
          name: 'Azure Key Vault',
          providerType: 'azure-key-vault',
          vaultUrl: legacy.vaultUrl,
          tenantId: legacy.tenantId,
          clientId: legacy.clientId,
          clientSecret: legacy.clientSecret ?? '',
        })
      } catch {
        // A name clash means it was already migrated. Nothing to do.
      }
    },

    async refreshProviders(context: any) {
      const providers = await Vue.prototype.$util.send('vault/providers/list')
      context.commit('setProviders', providers)
    },

    async addProvider(context: any, provider: VaultProviderInput) {
      const saved = await Vue.prototype.$util.send('vault/providers/add', { provider })
      await context.dispatch('refreshProviders')
      return saved
    },

    async updateProvider(context: any, provider: VaultProviderInput) {
      const saved = await Vue.prototype.$util.send('vault/providers/update', { provider })
      await context.dispatch('refreshProviders')
      return saved
    },

    async removeProvider(context: any, id: number) {
      await Vue.prototype.$util.send('vault/providers/remove', { id })
      await context.dispatch('refreshProviders')
    },

    async reorderProviders(context: any, ids: number[]) {
      const providers = await Vue.prototype.$util.send('vault/providers/reorder', { ids })
      context.commit('setProviders', providers)
    },

    async testProvider(_context: any, provider: VaultProviderInput) {
      return await Vue.prototype.$util.send('vault/providers/test', { provider })
    },

    async saveFieldMappings(context: any, mappings: Partial<VaultFieldMappings>) {
      const normalized = normalizeFieldMappings(mappings)
      await Vue.prototype.$util.send('appdb/setting/set', {
        key: MAPPINGS_KEY,
        value: JSON.stringify(normalized),
      })
      context.commit('setFieldMappings', normalized)
    },

    async resolve(context: any, refs: VaultSecretRef[]): Promise<VaultResolveResult> {
      return await Vue.prototype.$util.send('vault/resolve', {
        refs,
        mappings: context.state.fieldMappings,
      })
    },
  },
}

export type { VaultFieldKey }
