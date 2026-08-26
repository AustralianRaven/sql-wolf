import rawLog from '@bksLogger'
import { buildVaultProvider } from './registry'
import {
  VaultConflict, VaultProviderConfig, VaultResolution, VaultSecretRef, VaultSource
} from './types'

const log = rawLog.scope('VaultResolver')

/**
 * Resolve an ordered list of secret refs against an ordered list of providers.
 *
 * Two independent orderings are at work here, and confusing them is the usual
 * source of surprise:
 *
 *   Ref order      (set on the connection)  — tier precedence. Which value wins.
 *   Provider order (set in Settings)        — where an UNPINNED ref looks.
 *
 * A ref that pins a vault ignores provider order entirely.
 *
 * Failure is per-ref. One unreachable vault degrades that tier only; the rest
 * still resolve. An all-or-nothing fetch makes one expired credential look like
 * total breakage.
 */
export async function resolveSecretRefs(
  refs: VaultSecretRef[],
  providers: VaultProviderConfig[]
): Promise<VaultResolution> {
  const sources: VaultSource[] = []

  for (const ref of refs) {
    sources.push(await resolveOne(ref, providers))
  }

  const merged: Record<string, string> = {}
  const owner: Record<string, string> = {}
  const shadowed: Record<string, string[]> = {}

  // First ref to define a key keeps it. Later refs are recorded, not dropped
  // silently — otherwise a lower tier looks ignored and nobody can tell
  // "not fetched" from "overridden".
  for (const source of sources) {
    for (const [key, value] of Object.entries(source.variables)) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) {
        shadowed[key] = [...(shadowed[key] ?? []), source.secretName]
        continue
      }
      merged[key] = value
      owner[key] = source.secretName
    }
  }

  const conflicts: VaultConflict[] = Object.entries(shadowed).map(([key, shadowedBy]) => ({
    key,
    winner: owner[key],
    shadowedBy,
  }))

  return { sources, merged, owner, conflicts }
}

async function resolveOne(
  ref: VaultSecretRef,
  providers: VaultProviderConfig[]
): Promise<VaultSource> {
  const empty = { ref, secretName: ref.secretName, variables: {} }

  // An unknown pinned vault is an error, never a fallback. Falling through to a
  // different vault would hand back another environment's values under the same
  // keys — staging credentials pointed at production, with no warning.
  const candidates = ref.vaultName
    ? providers.filter((p) => p.name === ref.vaultName)
    : providers

  if (!candidates.length) {
    return {
      ...empty,
      vaultName: null,
      error: ref.vaultName
        ? `Vault '${ref.vaultName}' is not configured`
        : 'No vault is configured',
    }
  }

  let lastError: string | null = null

  for (const config of candidates) {
    try {
      const variables = await buildVaultProvider(config).fetchSecret(ref.secretName)
      return { ...empty, vaultName: config.name, variables, error: null }
    } catch (e) {
      lastError = e?.message ?? String(e)
      log.warn(`Vault '${config.name}' could not read secret '${ref.secretName}':`, lastError)
    }
  }

  return { ...empty, vaultName: null, error: lastError ?? `Secret '${ref.secretName}' was not found` }
}
