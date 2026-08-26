import { VaultSecretRef } from './types'

/**
 * Wire format for the ordered secret refs stored on a connection:
 *
 *     Qa Vault:devau--qa-a-sa,Qa Vault:devau,Shared Vault:global
 *
 * Most specific first. Each entry is `<vaultName>:<secretName>`, or a bare
 * `<secretName>` to search every vault in provider order.
 */

/**
 * Split on the LAST colon. Secret names cannot contain a colon but vault names
 * can, so this is the only unambiguous split.
 */
export function parseVaultSecretRef(entry: string): VaultSecretRef | null {
  const trimmed = entry.trim()
  if (!trimmed) return null

  const split = trimmed.lastIndexOf(':')
  if (split === -1) return { vaultName: '', secretName: trimmed }

  const secretName = trimmed.slice(split + 1).trim()
  if (!secretName) return null

  return { vaultName: trimmed.slice(0, split).trim(), secretName }
}

export function parseVaultSecretRefs(raw?: string | null): VaultSecretRef[] {
  if (!raw) return []
  return raw.split(',').map(parseVaultSecretRef).filter((r): r is VaultSecretRef => r !== null)
}

export function serializeVaultSecretRefs(refs: VaultSecretRef[]): string {
  return refs
    .filter((r) => r.secretName?.trim())
    .map((r) => (r.vaultName?.trim() ? `${r.vaultName.trim()}:${r.secretName.trim()}` : r.secretName.trim()))
    .join(',')
}

/**
 * Refs for a connection, newest field first and the legacy single-secret field
 * as a fallback. Connections saved before multi-vault keep working untouched.
 */
export function connectionSecretRefs(config: {
  vaultSecretRefs?: string | null
  vaultSecretName?: string | null
}): VaultSecretRef[] {
  const refs = parseVaultSecretRefs(config?.vaultSecretRefs)
  if (refs.length) return refs
  return parseVaultSecretRefs(config?.vaultSecretName)
}
