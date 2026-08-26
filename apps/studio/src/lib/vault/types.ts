/**
 * Multi-vault secret resolution.
 *
 * Three layers, deliberately kept apart:
 *   1. Providers      — connection details for a vault. Per-machine, encrypted, ordered.
 *   2. Secret refs    — an ordered list of {vaultName, secretName} stored on a connection.
 *   3. Resolved values — merged by ref order, applied to connection fields via the mappings.
 *
 * A ref pins a vault by its display NAME, never its id. The id is local to one
 * machine; the name survives being exported and imported on someone else's.
 */

/** The connection fields a vault secret can populate. */
export const VAULT_FIELD_KEYS = [
  'host', 'port', 'username', 'password', 'defaultDatabase',
  'sslCa', 'sslCert', 'sslKey',
  'sshHost', 'sshPort', 'sshUsername', 'sshPassword'
] as const

export type VaultFieldKey = typeof VAULT_FIELD_KEYS[number]

export type VaultFieldMappings = Record<VaultFieldKey, string>

export type VaultProviderType = 'azure-key-vault'

/** A provider as the main process holds it — includes the decrypted secret. */
export interface VaultProviderConfig {
  id?: number
  name: string
  providerType: VaultProviderType
  vaultUrl: string
  tenantId: string
  clientId: string
  clientSecret: string
}

/** A provider as the renderer sees it. The credential is replaced by a boolean. */
export interface SafeVaultProvider {
  id: number
  name: string
  providerType: VaultProviderType
  vaultUrl: string
  tenantId: string
  clientId: string
  hasClientSecret: boolean
  position: number
}

/** One tier of secrets. An empty vaultName means "any vault, in provider order". */
export interface VaultSecretRef {
  vaultName: string
  secretName: string
}

/** What happened when one ref was resolved. */
export interface VaultSource {
  ref: VaultSecretRef
  /** The provider that actually answered. Null when the ref failed. */
  vaultName: string | null
  secretName: string
  variables: Record<string, string>
  error: string | null
}

/** A key defined by more than one ref. The first ref in the list wins. */
export interface VaultConflict {
  key: string
  /** The secret name that supplied the winning value. */
  winner: string
  /** Secret names that also defined the key and were ignored. */
  shadowedBy: string[]
}

export interface VaultResolution {
  /** Per-ref outcome, in ref order. Includes failures. */
  sources: VaultSource[]
  /** Final key -> value, first ref to define a key keeps it. */
  merged: Record<string, string>
  /** key -> the secret name that supplied it. */
  owner: Record<string, string>
  conflicts: VaultConflict[]
}

export interface VaultTestResult {
  success: boolean
  error?: string
}

/**
 * Every provider implements exactly this.
 *
 * `fetchSecret` returns an OBJECT, not a string. One vault secret holds a JSON
 * blob of many values, so a whole tier of config arrives in one round trip.
 */
export interface VaultProvider {
  testConnection(): Promise<VaultTestResult>
  fetchSecret(secretName: string): Promise<Record<string, string>>
}
