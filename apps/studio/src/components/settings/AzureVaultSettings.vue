<template>
  <div class="azure-vault-settings">
    <div class="setting-section-title">Azure Key Vault</div>

    <div class="form-group">
      <label class="checkbox-group" for="vaultEnabled">
        <input
          class="form-control"
          id="vaultEnabled"
          type="checkbox"
          v-model="form.enabled"
        />
        <span>Enable Azure Key Vault</span>
      </label>
    </div>

    <template v-if="form.enabled">
      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Tenant ID</label>
          <input type="text" class="form-control" v-model="form.tenantId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Client ID</label>
          <input type="text" class="form-control" v-model="form.clientId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
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
              placeholder="Client secret value"
            />
            <i class="material-icons password-icon" @click.prevent="showSecret = !showSecret">
              {{ showSecret ? 'visibility_off' : 'visibility' }}
            </i>
          </div>
        </div>
      </div>

      <div class="row gutter">
        <div class="col s12 form-group">
          <label>Vault URL</label>
          <input type="text" class="form-control" v-model="form.vaultUrl" placeholder="https://my-vault.vault.azure.net/" />
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
          {{ testResult.success ? 'Connected successfully' : testResult.error }}
        </span>
      </div>

      <div class="setting-subsection-title">Field Mappings</div>
      <p class="mapping-help">
        Map your vault secret's JSON keys to connection fields. Leave blank to use the default key name.
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
            v-model="form.fieldMappings[field.key]"
            :placeholder="field.key"
          />
        </div>
      </div>
    </template>

    <div class="settings-actions">
      <button class="btn btn-primary" @click.prevent="save" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
      <span v-if="saved" class="saved-indicator">
        <i class="material-icons">check</i> Saved
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'
import { AzureVaultConfig } from '@/lib/azure/AzureVaultService'

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

export default Vue.extend({
  data() {
    return {
      form: null as AzureVaultConfig | null,
      showSecret: false,
      testing: false,
      testResult: null as { success: boolean; error?: string } | null,
      saving: false,
      saved: false,
      mappingFields: MAPPING_FIELDS,
    }
  },
  computed: {
    ...mapGetters('azureVault', ['config']),
  },
  watch: {
    config: {
      immediate: true,
      handler(val: AzureVaultConfig) {
        this.form = JSON.parse(JSON.stringify(val))
      },
    },
  },
  methods: {
    async testConnection() {
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await this.$store.dispatch('azureVault/test', this.form)
      } finally {
        this.testing = false
      }
    },
    async save() {
      this.saving = true
      this.saved = false
      try {
        await this.$store.dispatch('azureVault/save', this.form)
        this.saved = true
        setTimeout(() => { this.saved = false }, 3000)
      } finally {
        this.saving = false
      }
    },
  },
})
</script>

<style lang="scss" scoped>
.setting-section-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.setting-subsection-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.04rem;
  color: var(--text-dark);
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

.test-connection-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;

  &.success { color: var(--theme-success, #4caf50); }
  &.error   { color: var(--theme-danger, #f44336); }

  .material-icons { font-size: 1rem; }
}

.mapping-help {
  font-size: 0.8rem;
  color: var(--text-dark);
  margin-bottom: 0.75rem;
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

.mapping-row {
  display: contents;
}

.mapping-label {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
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

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
