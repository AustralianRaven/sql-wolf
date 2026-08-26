import { AzureVaultProvider } from './providers/AzureVaultProvider'
import { VaultProvider, VaultProviderConfig, VaultProviderType } from './types'

/** Adding a provider is one entry here plus a class implementing VaultProvider. */
const PROVIDERS: Record<VaultProviderType, (config: VaultProviderConfig) => VaultProvider> = {
  'azure-key-vault': (config) => new AzureVaultProvider(config),
}

export const VAULT_PROVIDER_TYPES: { value: VaultProviderType; label: string }[] = [
  { value: 'azure-key-vault', label: 'Azure Key Vault' },
]

export function buildVaultProvider(config: VaultProviderConfig): VaultProvider {
  const factory = PROVIDERS[config.providerType]
  if (!factory) {
    throw new Error(`Unknown vault type '${config.providerType}'`)
  }
  return factory(config)
}
