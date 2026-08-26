import { ClientSecretCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import rawLog from '@bksLogger'
import { VaultProvider, VaultProviderConfig, VaultTestResult } from '../types'

const log = rawLog.scope('AzureVaultProvider')

/**
 * Azure Key Vault behind the generic provider interface. Deliberately thin —
 * swapping in HashiCorp or AWS Secrets Manager means writing one of these and
 * adding a registry entry. Nothing above this file changes.
 */
export class AzureVaultProvider implements VaultProvider {
  private client: SecretClient

  constructor(config: VaultProviderConfig) {
    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    )
    this.client = new SecretClient(config.vaultUrl, credential)
  }

  async testConnection(): Promise<VaultTestResult> {
    try {
      // One page of the secret list is enough to prove auth and reachability.
      const iter = this.client.listPropertiesOfSecrets()
      await iter.next()
      return { success: true }
    } catch (e) {
      log.error('Azure Key Vault test connection failed:', e)
      return { success: false, error: e?.message ?? String(e) }
    }
  }

  async fetchSecret(secretName: string): Promise<Record<string, string>> {
    const response = await this.client.getSecret(secretName)
    const raw = response.value

    if (!raw) {
      throw new Error(`Secret '${secretName}' has no value`)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(`Secret '${secretName}' is not valid JSON`)
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Secret '${secretName}' must be a JSON object of key/value pairs`)
    }

    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || value === undefined) continue
      result[key] = typeof value === 'string' ? value : String(value)
    }
    return result
  }
}
