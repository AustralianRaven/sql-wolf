<template>
  <div class="vault-settings">
    <div class="setting-section-title">Key Vaults</div>

    <p class="section-help">
      Add one vault per environment. The order below is the fallback order: a connection
      secret that does not name a vault is looked for in each vault from the top down.
      Connections pin a vault by <em>name</em>, so a teammate who adds a vault with the
      same name gets the same wiring without editing anything.
    </p>

    <div v-if="providers.length === 0" class="empty-state">
      No vaults configured. Connections will not show the vault panel until one exists.
    </div>

    <ul v-else class="vault-list">
      <li v-for="(provider, index) in providers" :key="provider.id" class="vault-row">
        <div class="vault-order">
          <button
            class="btn btn-flat btn-icon"
            :disabled="index === 0"
            title="Move up"
            @click.prevent="move(index, -1)"
          >
            <i class="material-icons">arrow_upward</i>
          </button>
          <button
            class="btn btn-flat btn-icon"
            :disabled="index === providers.length - 1"
            title="Move down"
            @click.prevent="move(index, 1)"
          >
            <i class="material-icons">arrow_downward</i>
          </button>
        </div>

        <div class="vault-info">
          <div class="vault-name">{{ provider.name }}</div>
          <div class="vault-url">{{ provider.vaultUrl || 'No vault URL set' }}</div>
        </div>

        <span
          v-if="!provider.hasClientSecret"
          class="vault-warning"
          title="No client secret stored"
        >
          <i class="material-icons">warning</i> No secret
        </span>

        <div class="vault-actions">
          <button class="btn btn-flat" @click.prevent="edit(provider)">Edit</button>
          <button class="btn btn-flat danger" @click.prevent="remove(provider)">Remove</button>
        </div>
      </li>
    </ul>

    <button v-if="!form" class="btn btn-primary add-btn" @click.prevent="startAdd">
      <i class="material-icons">add</i> Add Vault
    </button>

    <div v-if="form" class="vault-form">
      <div class="setting-subsection-title">{{ form.id ? 'Edit Vault' : 'Add Vault' }}</div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Name</label>
          <input
            type="text"
            class="form-control"
            v-model="form.name"
            placeholder="e.g. Qa Vault"
          />
          <small class="help text-muted">
            The identifier connections pin to. Agree it with the team before using it —
            renaming a vault breaks every connection that names it.
          </small>
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Vault Type</label>
          <select class="form-control" v-model="form.providerType">
            <option v-for="t in providerTypes" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Vault URL</label>
          <input
            type="text"
            class="form-control"
            v-model="form.vaultUrl"
            placeholder="https://my-vault.vault.azure.net/"
          />
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Tenant ID</label>
          <input
            type="text"
            class="form-control"
            v-model="form.tenantId"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Client ID</label>
          <input
            type="text"
            class="form-control"
            v-model="form.clientId"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Client Secret</label>
          <div class="password-wrap">
            <input
              :type="showSecret ? 'text' : 'password'"
              class="form-control password"
              v-model="form.clientSecret"
              :placeholder="secretPlaceholder"
            />
            <i class="material-icons password-icon" @click.prevent="showSecret = !showSecret">
              {{ showSecret ? 'visibility_off' : 'visibility' }}
            </i>
          </div>
          <small v-if="form.hasClientSecret" class="help text-muted">
            The stored secret is never displayed. Leaving this blank keeps it.
          </small>
        </div>
      </div>

      <div class="test-connection-row">
        <button class="btn btn-flat" :disabled="testing" @click.prevent="testConnection">
          <i class="material-icons" v-if="!testing">wifi</i>
          <i class="material-icons spin" v-else>refresh</i>
          Test Connection
        </button>
        <span v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
          <i class="material-icons">{{ testResult.success ? 'check_circle' : 'error' }}</i>
          {{ testResult.success ? 'Connected' : testResult.error }}
        </span>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="saving || !form.name" @click.prevent="save">
          {{ saving ? 'Saving…' : 'Save Vault' }}
        </button>
        <button class="btn btn-flat" @click.prevent="cancel">Cancel</button>
        <span v-if="formError" class="test-result error">
          <i class="material-icons">error</i> {{ formError }}
        </span>
      </div>
    </div>

    <div class="setting-subsection-title">Field Mappings</div>
    <p class="section-help">
      Maps the JSON keys inside a vault secret to connection fields. Leave a row blank to
      use the field name as the key. These mappings apply to every vault.
    </p>

    <div class="mapping-table">
      <div class="mapping-header">
        <span>Connection Field</span>
        <span>Vault Key Name</span>
      </div>
      <div class="mapping-row" v-for="field in mappingFields" :key="field.key">
        <label class="mapping-label">{{ field.label }}</label>
        <input
          type="text"
          class="form-control"
          v-model="mappingsForm[field.key]"
          :placeholder="field.key"
        />
      </div>
    </div>

    <div class="settings-actions">
      <button class="btn btn-primary" @click.prevent="saveMappings" :disabled="savingMappings">
        {{ savingMappings ? 'Saving…' : 'Save Mappings' }}
      </button>
      <span v-if="mappingsSaved" class="saved-indicator">
        <i class="material-icons">check</i> Saved
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'
import { VAULT_PROVIDER_TYPES } from '@/lib/vault/registry'
import { SafeVaultProvider, VaultFieldMappings } from '@/lib/vault/types'

const MAPPING_FIELDS = [
  { key: 'host', label: 'Host' },
  { key: 'port', label: 'Port' },
  { key: 'username', label: 'Username' },
  { key: 'password', label: 'Password' },
  { key: 'defaultDatabase', label: 'Default Database' },
  { key: 'sslCa', label: 'SSL CA' },
  { key: 'sslCert', label: 'SSL Certificate' },
  { key: 'sslKey', label: 'SSL Key' },
  { key: 'sshHost', label: 'SSH Host' },
  { key: 'sshPort', label: 'SSH Port' },
  { key: 'sshUsername', label: 'SSH Username' },
  { key: 'sshPassword', label: 'SSH Password' },
]

interface VaultForm {
  id?: number
  name: string
  providerType: string
  vaultUrl: string
  tenantId: string
  clientId: string
  clientSecret: string
  hasClientSecret: boolean
}

function blankForm(): VaultForm {
  return {
    name: '',
    providerType: 'azure-key-vault',
    vaultUrl: '',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    hasClientSecret: false,
  }
}

export default Vue.extend({
  data() {
    return {
      form: null as VaultForm | null,
      showSecret: false,
      testing: false,
      testResult: null as { success: boolean; error?: string } | null,
      saving: false,
      formError: null as string | null,
      mappingFields: MAPPING_FIELDS,
      mappingsForm: {} as VaultFieldMappings,
      savingMappings: false,
      mappingsSaved: false,
      providerTypes: VAULT_PROVIDER_TYPES,
    }
  },
  computed: {
    ...mapGetters('vault', ['providers', 'fieldMappings']),
    secretPlaceholder(): string {
      return this.form?.hasClientSecret
        ? 'Stored — leave blank to keep it'
        : 'Client secret value'
    },
  },
  watch: {
    fieldMappings: {
      immediate: true,
      handler(val: VaultFieldMappings) {
        this.mappingsForm = { ...val }
      },
    },
  },
  methods: {
    startAdd() {
      this.form = blankForm()
      this.testResult = null
      this.formError = null
    },
    edit(provider: SafeVaultProvider) {
      // clientSecret stays blank. The stored value never reaches the renderer.
      this.form = {
        id: provider.id,
        name: provider.name,
        providerType: provider.providerType,
        vaultUrl: provider.vaultUrl,
        tenantId: provider.tenantId,
        clientId: provider.clientId,
        clientSecret: '',
        hasClientSecret: provider.hasClientSecret,
      }
      this.testResult = null
      this.formError = null
    },
    cancel() {
      this.form = null
      this.testResult = null
      this.formError = null
    },
    async testConnection() {
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await this.$store.dispatch('vault/testProvider', this.form)
      } finally {
        this.testing = false
      }
    },
    async save() {
      this.saving = true
      this.formError = null
      try {
        const action = this.form.id ? 'vault/updateProvider' : 'vault/addProvider'
        await this.$store.dispatch(action, this.form)
        this.form = null
      } catch (e) {
        this.formError = e?.message ?? String(e)
      } finally {
        this.saving = false
      }
    },
    async remove(provider: SafeVaultProvider) {
      const message = `Remove '${provider.name}'? Connections that name this vault ` +
        `will fail to resolve until it is added back.`
      if (!window.confirm(message)) return
      await this.$store.dispatch('vault/removeProvider', provider.id)
      if (this.form?.id === provider.id) this.cancel()
    },
    async move(index: number, delta: number) {
      const ids = this.providers.map((p: SafeVaultProvider) => p.id)
      const target = index + delta
      if (target < 0 || target >= ids.length) return
      const [moved] = ids.splice(index, 1)
      ids.splice(target, 0, moved)
      await this.$store.dispatch('vault/reorderProviders', ids)
    },
    async saveMappings() {
      this.savingMappings = true
      this.mappingsSaved = false
      try {
        await this.$store.dispatch('vault/saveFieldMappings', this.mappingsForm)
        this.mappingsSaved = true
        setTimeout(() => { this.mappingsSaved = false }, 3000)
      } finally {
        this.savingMappings = false
      }
    },
  },
})
</script>

<style lang="scss" scoped>
.setting-section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.setting-subsection-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 1.5rem 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.04rem;
  color: var(--text-dark);
}

.section-help {
  font-size: 0.8rem;
  color: var(--text-dark);
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.empty-state {
  font-size: 0.85rem;
  color: var(--text-dark);
  padding: 0.75rem;
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.vault-list {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
}

.vault-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 0.35rem;
}

.vault-order {
  display: flex;
  flex-direction: column;

  .btn {
    padding: 0;
    min-width: 0;
    height: 1.1rem;
  }

  .material-icons { font-size: 0.95rem; }
}

.vault-info {
  flex: 1;
  min-width: 0;
}

.vault-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.vault-url {
  font-size: 0.75rem;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-warning {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.75rem;
  color: var(--theme-warning, #ff9800);

  .material-icons { font-size: 0.95rem; }
}

.vault-actions {
  display: flex;
  gap: 0.25rem;

  .danger { color: var(--theme-danger, #f44336); }
}

.add-btn .material-icons { font-size: 1.1rem; }

.vault-form {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  margin-top: 0.75rem;
}

.password-wrap {
  position: relative;

  .password-icon {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    font-size: 1.1rem;
    color: var(--text-dark);
    user-select: none;
  }
}

.test-connection-row,
.form-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;

  &.success { color: var(--theme-success, #4caf50); }
  &.error   { color: var(--theme-danger, #f44336); }

  .material-icons { font-size: 1rem; }
}

.help {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.75rem;
  line-height: 1.4;
}

.mapping-table {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem 1rem;
  margin-bottom: 1rem;
}

.mapping-header {
  display: contents;

  span {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04rem;
    color: var(--text-dark);
    padding-bottom: 0.25rem;
  }
}

.mapping-row { display: contents; }

.mapping-label {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.saved-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--theme-success, #4caf50);

  .material-icons { font-size: 1rem; }
}

.spin { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
