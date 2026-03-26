export default {
  name: '20260326_add_vault_secret_name',
  async run(runner) {
    await runner.query('ALTER TABLE saved_connection ADD COLUMN vaultSecretName varchar')
  }
}
