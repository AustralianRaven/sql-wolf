import Vue from 'vue'
import { AzureVaultConfig } from '@/lib/azure/AzureVaultService'

const SETTING_KEY = 'azure_vault_config'

const DEFAULT_MAPPINGS: AzureVaultConfig['fieldMappings'] = {
  host: '',
  port: '',
  username: '',
  password: '',
  defaultDatabase: '',
  sslCa: '',
  sslCert: '',
  sslKey: '',
  sshHost: '',
  sshPort: '',
  sshUsername: '',
  sshPassword: '',
}

const DEFAULT_CONFIG: AzureVaultConfig = {
  enabled: false,
  tenantId: '',
  clientId: '',
  clientSecret: '',
  vaultUrl: '',
  fieldMappings: { ...DEFAULT_MAPPINGS },
}

interface AzureVaultState {
  config: AzureVaultConfig
  loaded: boolean
}

export const AzureVaultModule = {
  namespaced: true,
  state(): AzureVaultState {
    return {
      config: { ...DEFAULT_CONFIG, fieldMappings: { ...DEFAULT_MAPPINGS } },
      loaded: false,
    }
  },
  getters: {
    config: (state: AzureVaultState) => state.config,
    enabled: (state: AzureVaultState) => state.config.enabled,
  },
  mutations: {
    setConfig(state: AzureVaultState, config: AzureVaultConfig) {
      state.config = config
      state.loaded = true
    },
  },
  actions: {
    async load(context: any) {
      try {
        const raw = await Vue.prototype.$util.send('appdb/setting/get', { key: SETTING_KEY })
        if (raw?.value) {
          const parsed = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value
          context.commit('setConfig', {
            ...DEFAULT_CONFIG,
            ...parsed,
            fieldMappings: { ...DEFAULT_MAPPINGS, ...(parsed.fieldMappings ?? {}) },
          })
        }
      } catch {
        // No saved config yet — use defaults
      }
    },
    async save(context: any, config: AzureVaultConfig) {
      await Vue.prototype.$util.send('appdb/setting/set', {
        key: SETTING_KEY,
        value: JSON.stringify(config),
      })
      context.commit('setConfig', config)
    },
    async test(_context: any, config: AzureVaultConfig) {
      return await Vue.prototype.$util.send('azure-vault/test', { config })
    },
  },
}
