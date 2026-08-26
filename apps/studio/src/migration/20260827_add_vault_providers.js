export default {
  name: '20260827_add_vault_providers',
  async run(runner) {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS vault_provider (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR NOT NULL UNIQUE,
        providerType VARCHAR NOT NULL DEFAULT 'azure-key-vault',
        vaultUrl VARCHAR,
        tenantId VARCHAR,
        clientId VARCHAR,
        clientSecret VARCHAR,
        position INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        version INTEGER NOT NULL DEFAULT 1
      )
    `)
    // Ordered secret refs, most specific first: "Qa Vault:devau,Shared:global".
    // vaultSecretName stays for connections saved before multi-vault.
    await runner.query('ALTER TABLE saved_connection ADD COLUMN vaultSecretRefs varchar')
  }
}
