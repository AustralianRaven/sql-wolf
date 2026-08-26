<template>
  <div class="vault-loader">
    <div class="vault-loader-header" @click.prevent="expanded = !expanded">
      <i class="material-icons">lock</i>
      <span>Vault Secrets</span>
      <span v-if="refs.length" class="ref-count">{{ refs.length }}</span>
      <i class="material-icons expand-icon">{{ expanded ? 'expand_less' : 'expand_more' }}</i>
    </div>

    <div v-if="expanded" class="vault-loader-body">
      <p class="panel-help">
        List one secret per tier, most specific first. The first tier to define a value
        keeps it. Pin a row to a vault by name, or leave it as Any vault to search every
        vault in the order set in Settings.
      </p>

      <div v-if="refs.length === 0" class="empty-state">
        No vault secrets configured for this connection.
      </div>

      <div v-for="(ref, index) in refs" :key="index" class="ref-row">
        <div class="ref-order">
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
            :disabled="index === refs.length - 1"
            title="Move down"
            @click.prevent="move(index, 1)"
          >
            <i class="material-icons">arrow_downward</i>
          </button>
        </div>

        <select
          class="form-control ref-vault"
          :value="ref.vaultName"
          @change="updateRef(index, 'vaultName', $event.target.value)"
        >
          <option value="">Any vault</option>
          <option v-for="name in providerNames" :key="name" :value="name">{{ name }}</option>
        </select>

        <input
          type="text"
          class="form-control ref-secret"
          :value="ref.secretName"
          placeholder="Secret name, e.g. devau--qa-a-sa"
          @input="updateRef(index, 'secretName', $event.target.value)"
          @keydown.enter.prevent="fetch"
        />

        <button class="btn btn-flat btn-icon danger" title="Remove" @click.prevent="removeRef(index)">
          <i class="material-icons">close</i>
        </button>
      </div>

      <div class="ref-actions">
        <button class="btn btn-flat" @click.prevent="addRef">
          <i class="material-icons">add</i> Add Secret
        </button>
        <button
          class="btn btn-primary"
          :disabled="!hasUsableRefs || loading"
          @click.prevent="fetch"
        >
          <i class="material-icons" v-if="!loading">cloud_download</i>
          <i class="material-icons spin" v-else>refresh</i>
          Fetch Vault Details
        </button>
      </div>

      <div v-if="status" :class="['vault-status', status.type]">
        <i class="material-icons">{{ statusIcon }}</i>
        {{ status.message }}
      </div>

      <div v-if="resolution" class="result-panel">
        <div class="result-toolbar">
          <label for="vaultSource">Showing</label>
          <select id="vaultSource" class="form-control" v-model="selectedSource">
            <option value="__merged__">Merged ({{ mergedKeyCount }} keys)</option>
            <option v-for="(source, i) in resolution.sources" :key="i" :value="String(i)">
              {{ sourceLabel(source) }}
            </option>
          </select>
          <span class="expand-spacer" />
          <button
            class="btn btn-primary"
            :disabled="mapped.length === 0"
            @click.prevent="apply"
          >
            Apply {{ mapped.length }} to connection
          </button>
        </div>

        <div v-if="failedCount" class="vault-status error">
          <i class="material-icons">error</i>
          {{ failedCount }} of {{ resolution.sources.length }} secrets could not be read.
        </div>

        <div v-if="selectedSourceError" class="vault-status error">
          <i class="material-icons">error</i> {{ selectedSourceError }}
        </div>

        <table v-if="visibleRows.length" class="result-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>From</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visibleRows" :key="row.key" :class="{ shadowed: row.shadowed }">
              <td class="key-cell">
                {{ row.key }}
                <span v-if="row.shadowed" class="shadow-note" :title="row.shadowNote">overridden</span>
              </td>
              <td class="value-cell">{{ maskValue(row.key, row.value) }}</td>
              <td class="owner-cell">{{ row.owner }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="mapped.length === 0 && mergedKeyCount > 0" class="vault-status error">
          <i class="material-icons">error</i>
          None of the fetched keys match the field mappings in Settings.
        </div>

        <div v-if="mapped.length" class="mapped-summary">
          Maps to: {{ mappedFieldLabels }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'
import { connectionSecretRefs, serializeVaultSecretRefs } from '@/lib/vault/refs'
import { MappedVaultField } from '@/lib/vault/mapping'
import { VaultResolution, VaultSecretRef, VaultSource } from '@/lib/vault/types'

/** Vault keys whose values are never shown in full in the result table. */
const SENSITIVE_FIELDS = ['password', 'sshpassword', 'secret', 'token', 'key']

interface ResultRow {
  key: string
  value: string
  owner: string
  shadowed: boolean
  shadowNote: string
}

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
      loading: false,
      refs: [] as VaultSecretRef[],
      resolution: null as VaultResolution | null,
      mapped: [] as MappedVaultField[],
      selectedSource: '__merged__',
      status: null as { type: 'success' | 'error'; message: string } | null,
    }
  },
  computed: {
    ...mapGetters('vault', ['providerNames', 'fieldMappings']),

    hasUsableRefs(): boolean {
      return this.refs.some((r: VaultSecretRef) => r.secretName?.trim())
    },
    statusIcon(): string {
      return this.status?.type === 'success' ? 'check_circle' : 'error'
    },
    mergedKeyCount(): number {
      return Object.keys(this.resolution?.merged ?? {}).length
    },
    failedCount(): number {
      return this.resolution?.sources.filter((s: VaultSource) => s.error).length ?? 0
    },
    selectedSourceError(): string | null {
      if (this.selectedSource === '__merged__') return null
      return this.resolution?.sources[Number(this.selectedSource)]?.error ?? null
    },
    mappedFieldLabels(): string {
      return this.mapped.map((m: MappedVaultField) => m.field).join(', ')
    },

    /**
     * Merged view lists the winning value per key. A single-tier view lists that
     * tier's keys and marks the ones a higher tier overrode, so a tier that looks
     * ignored can be told apart from a tier that failed to load.
     */
    visibleRows(): ResultRow[] {
      if (!this.resolution) return []

      if (this.selectedSource === '__merged__') {
        return Object.entries(this.resolution.merged).map(([key, value]) => ({
          key,
          value,
          owner: this.resolution.owner[key] ?? '',
          shadowed: false,
          shadowNote: '',
        }))
      }

      const source = this.resolution.sources[Number(this.selectedSource)]
      if (!source) return []

      return Object.entries(source.variables).map(([key, value]) => {
        const winner = this.resolution.owner[key]
        const shadowed = Boolean(winner) && winner !== source.secretName
        return {
          key,
          value,
          owner: source.secretName,
          shadowed,
          shadowNote: shadowed ? `Overridden by ${winner}` : '',
        }
      })
    },
  },
  watch: {
    // Editing rows rewrites the connection field, so the refs save with the
    // connection. Values are never written here — only the refs.
    refs: {
      deep: true,
      handler(val: VaultSecretRef[]) {
        this.$set(this.config, 'vaultSecretRefs', serializeVaultSecretRefs(val))
      },
    },
  },
  mounted() {
    this.refs = connectionSecretRefs(this.config)
  },
  methods: {
    addRef() {
      this.refs.push({ vaultName: '', secretName: '' })
    },
    removeRef(index: number) {
      this.refs.splice(index, 1)
    },
    updateRef(index: number, key: 'vaultName' | 'secretName', value: string) {
      this.$set(this.refs, index, { ...this.refs[index], [key]: value })
    },
    move(index: number, delta: number) {
      const target = index + delta
      if (target < 0 || target >= this.refs.length) return
      const next = [...this.refs]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      this.refs = next
    },

    sourceLabel(source: VaultSource): string {
      const vault = source.vaultName || source.ref.vaultName || 'Any vault'
      const count = Object.keys(source.variables).length
      const detail = source.error ? 'failed' : `${count} keys`
      return `${vault} / ${source.secretName} (${detail})`
    },

    maskValue(key: string, value: string): string {
      const lower = key.toLowerCase()
      const sensitive = SENSITIVE_FIELDS.some((f) => lower.includes(f))
      return sensitive ? '••••••••' : value
    },

    async fetch() {
      const usable = this.refs.filter((r: VaultSecretRef) => r.secretName?.trim())
      if (!usable.length) return

      this.loading = true
      this.status = null
      this.resolution = null
      this.mapped = []

      try {
        const result = await this.$store.dispatch('vault/resolve', usable)
        this.resolution = result.resolution
        this.mapped = result.mapped
        this.selectedSource = '__merged__'

        const failed = result.resolution.sources.filter((s: VaultSource) => s.error).length
        if (failed === usable.length) {
          this.status = { type: 'error', message: 'No secrets could be read. See the errors below.' }
        } else {
          this.status = {
            type: 'success',
            message: `Resolved ${Object.keys(result.resolution.merged).length} keys from ` +
              `${usable.length - failed} of ${usable.length} secrets.`,
          }
        }
      } catch (e) {
        this.status = { type: 'error', message: e?.message ?? String(e) }
      } finally {
        this.loading = false
      }
    },

    /**
     * Writes the mapped values onto the connection form. SSL and SSH fields go
     * through $set because they may not exist on every connection type yet.
     */
    apply() {
      const targets: Record<string, string> = {
        host: 'host',
        port: 'port',
        username: 'username',
        password: 'password',
        defaultDatabase: 'defaultDatabase',
        sslCa: 'sslCaFile',
        sslCert: 'sslCertFile',
        sslKey: 'sslKeyFile',
        sshHost: 'sshHost',
        sshPort: 'sshPort',
        sshUsername: 'sshUsername',
        sshPassword: 'sshPassword',
      }

      const applied: string[] = []

      for (const item of this.mapped) {
        const target = targets[item.field]
        if (!target) continue

        if (item.field === 'port' || item.field === 'sshPort') {
          const parsed = parseInt(item.value, 10)
          this.$set(this.config, target, Number.isNaN(parsed) ? item.value : parsed)
        } else {
          this.$set(this.config, target, item.value)
        }
        applied.push(item.field)
      }

      this.status = applied.length
        ? { type: 'success', message: `Applied: ${applied.join(', ')}` }
        : { type: 'error', message: 'Nothing to apply.' }
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

.ref-count {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0 0.35rem;
  border-radius: 8px;
  background: var(--border-color);
}

.vault-loader-body {
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid var(--border-color);
}

.panel-help {
  font-size: 0.75rem;
  color: var(--text-dark);
  line-height: 1.5;
  margin-bottom: 0.5rem;
}

.empty-state {
  font-size: 0.8rem;
  color: var(--text-dark);
  padding: 0.5rem;
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.ref-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
}

.ref-order {
  display: flex;
  flex-direction: column;

  .btn {
    padding: 0;
    min-width: 0;
    height: 1.05rem;
  }

  .material-icons { font-size: 0.9rem; }
}

.ref-vault {
  flex: 0 0 9rem;
}

.ref-secret {
  flex: 1;
  min-width: 0;
}

.danger { color: var(--theme-danger, #f44336); }

.ref-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;

  .material-icons { font-size: 1.05rem; }
}

.vault-status {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  font-size: 0.8rem;
  margin-top: 0.5rem;

  .material-icons {
    font-size: 1rem;
    margin-top: 1px;
  }

  &.success { color: var(--theme-success, #4caf50); }
  &.error   { color: var(--theme-danger, #f44336); }
}

.result-panel {
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.result-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;

  label {
    font-size: 0.75rem;
    margin: 0;
  }

  .form-control { flex: 1; min-width: 12rem; }
}

.expand-spacer { flex: 0 0 0; }

.result-table {
  width: 100%;
  font-size: 0.75rem;
  border-collapse: collapse;

  th {
    text-align: left;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04rem;
    color: var(--text-dark);
    padding: 0.2rem 0.3rem;
    border-bottom: 1px solid var(--border-color);
  }

  td {
    padding: 0.2rem 0.3rem;
    border-bottom: 1px solid var(--border-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 12rem;
  }

  tr.shadowed td {
    text-decoration: line-through;
    opacity: 0.55;
  }
}

.key-cell { font-weight: 600; }

.owner-cell { color: var(--text-dark); }

.shadow-note {
  margin-left: 0.3rem;
  font-size: 0.65rem;
  font-weight: 400;
  text-decoration: none;
  display: inline-block;
  color: var(--theme-warning, #ff9800);
}

.mapped-summary {
  font-size: 0.75rem;
  color: var(--text-dark);
  margin-top: 0.4rem;
}

.spin { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
