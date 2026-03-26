import { AzureVaultService, AzureVaultConfig, VaultTestResult, VaultSecretResult } from '@/lib/azure/AzureVaultService'

export interface IAzureVaultHandlers {
  'azure-vault/test': (args: { config: AzureVaultConfig }) => Promise<VaultTestResult>
  'azure-vault/get-secret': (args: { config: AzureVaultConfig; secretName: string }) => Promise<VaultSecretResult>
}

export const AzureVaultHandlers: IAzureVaultHandlers = {
  'azure-vault/test': async function ({ config }) {
    const svc = new AzureVaultService(config)
    return svc.testConnection()
  },
  'azure-vault/get-secret': async function ({ config, secretName }) {
    const svc = new AzureVaultService(config)
    return svc.getSecret(secretName)
  },
}
