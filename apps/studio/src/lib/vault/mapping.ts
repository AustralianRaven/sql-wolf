import { VaultFieldKey, VaultFieldMappings, VAULT_FIELD_KEYS } from './types'

export const DEFAULT_VAULT_FIELD_MAPPINGS: VaultFieldMappings = VAULT_FIELD_KEYS
  .reduce((acc, key) => ({ ...acc, [key]: '' }), {} as VaultFieldMappings)

export interface MappedVaultField {
  field: VaultFieldKey
  /** The vault key the value came from. */
  vaultKey: string
  value: string
}

/**
 * Turn merged vault values into connection fields using the mappings from
 * Settings. A blank mapping falls back to the field name itself, so a secret
 * whose keys already match needs no configuration at all.
 */
export function applyFieldMappings(
  merged: Record<string, string>,
  mappings?: Partial<VaultFieldMappings>
): MappedVaultField[] {
  const result: MappedVaultField[] = []

  for (const field of VAULT_FIELD_KEYS) {
    const vaultKey = mappings?.[field]?.trim() || field
    if (merged[vaultKey] === undefined) continue
    result.push({ field, vaultKey, value: merged[vaultKey] })
  }

  return result
}

export function normalizeFieldMappings(raw?: Partial<VaultFieldMappings>): VaultFieldMappings {
  return { ...DEFAULT_VAULT_FIELD_MAPPINGS, ...(raw ?? {}) }
}
