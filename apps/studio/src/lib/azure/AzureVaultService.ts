import { ClientSecretCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import rawLog from '@bksLogger'

const log = rawLog.scope('AzureVaultService')

export interface AzureVaultConfig {
  enabled: boolean
  tenantId: string
  clientId: string
  clientSecret: string
  vaultUrl: string
  fieldMappings: {
    host: string
    port: string
    username: string
    password: string
    defaultDatabase: string
    sslCa: string
    sslCert: string
    sslKey: string
    sshHost: string
    sshPort: string
    sshUsername: string
    sshPassword: string
  }
}

export interface VaultTestResult {
  success: boolean
  error?: string
}

export interface VaultSecretResult {
  host?: string
  port?: string
  username?: string
  password?: string
  defaultDatabase?: string
  sslCa?: string
  sslCert?: string
  sslKey?: string
  sshHost?: string
  sshPort?: string
  sshUsername?: string
  sshPassword?: string
}

const FIELD_KEYS = [
  'host', 'port', 'username', 'password', 'defaultDatabase',
  'sslCa', 'sslCert', 'sslKey',
  'sshHost', 'sshPort', 'sshUsername', 'sshPassword'
] as const

export class AzureVaultService {
  private client: SecretClient

  constructor(private config: AzureVaultConfig) {
    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    )
    this.client = new SecretClient(config.vaultUrl, credential)
  }

  async testConnection(): Promise<VaultTestResult> {
    try {
      // List secrets (just fetch the first page) to verify auth works
      const iter = this.client.listPropertiesOfSecrets()
      await iter.next()
      return { success: true }
    } catch (e) {
      log.error('Azure Vault test connection failed:', e)
      return { success: false, error: e?.message ?? String(e) }
    }
  }

  async getSecret(secretName: string): Promise<VaultSecretResult> {
    const response = await this.client.getSecret(secretName)
    const raw = response.value

    if (!raw) {
      throw new Error(`Secret '${secretName}' has no value`)
    }

    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(`Secret '${secretName}' is not valid JSON`)
    }

    const mappings = this.config.fieldMappings ?? {}
    const result: VaultSecretResult = {}

    for (const field of FIELD_KEYS) {
      // Use the user-configured mapping key, fall back to the field name itself
      const vaultKey = mappings[field] || field
      if (parsed[vaultKey] !== undefined) {
        result[field] = parsed[vaultKey]
      }
    }

    return result
  }
}
