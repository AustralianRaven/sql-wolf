<template>
  <div class="vault-loader">
    <div class="vault-loader-header" @click.prevent="expanded = !expanded">
      <i class="material-icons">lock</i>
      <span>Azure Key Vault</span>
      <i class="material-icons expand-icon">{{ expanded ? 'expand_less' : 'expand_more' }}</i>
    </div>

    <div v-if="expanded" class="vault-loader-body">
      <div class="row gutter">
        <div class="col form-group expand">
          <label>Secret Name</label>
          <div class="secret-input-wrap">
            <input
              :type="showSecret ? 'text' : 'password'"
              class="form-control"
              :value="config.vaultSecretName || ''"
              @input="config.vaultSecretName = $event.target.value"
              placeholder="e.g. prod-orders-db"
              @keydown.enter.prevent="load"
            />
            <i
              class="material-icons secret-toggle"
              @click.prevent="showSecret = !showSecret"
              :title="showSecret ? 'Hide secret name' : 'Show secret name'"
            >{{ showSecret ? 'visibility_off' : 'visibility' }}</i>
          </div>
        </div>
        <div class="col form-group load-btn-col">
          <button
            class="btn btn-primary"
            :disabled="!config.vaultSecretName || loading"
            @click.prevent="load"
          >
            <i class="material-icons" v-if="!loading">download</i>
            <i class="material-icons spin" v-else>refresh</i>
            Load
          </button>
        </div>
      </div>

      <div v-if="status" :class="['vault-status', status.type]">
        <i class="material-icons">{{ status.type === 'success' ? 'check_circle' : 'error' }}</i>
        {{ status.message }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'
import { AzureVaultConfig } from '@/lib/azure/AzureVaultService'

export default Vue.extend({
  props: {
    config: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      expanded: true,
      showSecret: false,
      loading: false,
      status: null as { type: 'success' | 'error'; message: string } | null,
    }
  },
  computed: {
    ...mapGetters('azureVault', { vaultConfig: 'config' }),
  },
  methods: {
    async load() {
      if (!this.config.vaultSecretName) return
      this.loading = true
      this.status = null
      try {
        const result = await this.$util.send('azure-vault/get-secret', {
          config: this.vaultConfig as AzureVaultConfig,
          secretName: this.config.vaultSecretName,
        })

        const mapped: string[] = []

        if (result.host !== undefined)            { this.config.host = result.host; mapped.push('host') }
        if (result.port !== undefined)            { this.config.port = parseInt(result.port, 10) || result.port; mapped.push('port') }
        if (result.username !== undefined)        { this.config.username = result.username; mapped.push('username') }
        if (result.password !== undefined)        { this.config.password = result.password; mapped.push('password') }
        if (result.defaultDatabase !== undefined) { this.config.defaultDatabase = result.defaultDatabase; mapped.push('database') }
        if (result.sslCa !== undefined)           { this.$set(this.config, 'sslCaFile', result.sslCa); mapped.push('SSL CA') }
        if (result.sslCert !== undefined)         { this.$set(this.config, 'sslCertFile', result.sslCert); mapped.push('SSL cert') }
        if (result.sslKey !== undefined)          { this.$set(this.config, 'sslKeyFile', result.sslKey); mapped.push('SSL key') }
        if (result.sshHost !== undefined)         { this.$set(this.config, 'sshHost', result.sshHost); mapped.push('SSH host') }
        if (result.sshPort !== undefined)         { this.$set(this.config, 'sshPort', result.sshPort); mapped.push('SSH port') }
        if (result.sshUsername !== undefined)     { this.$set(this.config, 'sshUsername', result.sshUsername); mapped.push('SSH user') }
        if (result.sshPassword !== undefined)     { this.$set(this.config, 'sshPassword', result.sshPassword); mapped.push('SSH password') }

        if (mapped.length === 0) {
          this.status = { type: 'error', message: 'Secret found but no fields matched the configured mappings.' }
        } else {
          this.status = { type: 'success', message: `Loaded: ${mapped.join(', ')}` }
        }
      } catch (e) {
        this.status = { type: 'error', message: e?.message ?? String(e) }
      } finally {
        this.loading = false
      }
    },
  },
})
</script>

<style lang="scss" scoped>
.vault-loader {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.vault-loader-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.875rem;
  font-weight: 600;

  .material-icons { font-size: 1.1rem; }

  .expand-icon { margin-left: auto; }
}

.vault-loader-body {
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid var(--border-color);
}

.secret-input-wrap {
  position: relative;

  .form-control {
    padding-right: 2rem;
  }

  .secret-toggle {
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

.load-btn-col {
  flex: 0 0 auto;
  padding-top: 1.5rem;
}

.vault-status {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  font-size: 0.8rem;
  margin-top: 0.25rem;

  .material-icons { font-size: 1rem; margin-top: 1px; }

  &.success { color: var(--theme-success, #4caf50); }
  &.error   { color: var(--theme-danger, #f44336); }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
