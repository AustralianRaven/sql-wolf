<template>
  <portal to="modals">
    <modal
      name="app-settings-modal"
      class="vue-dialog beekeeper-modal app-settings-modal"
      height="auto"
      :scrollable="true"
      :max-height="750"
    >
      <div v-kbd-trap="true">
        <div class="dialog-content">
          <div class="dialog-c-title">
            Settings
            <a class="close-btn btn btn-fab" href="#" @click.prevent="close">
              <i class="material-icons">clear</i>
            </a>
          </div>

          <div class="settings-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="settings-tab-btn"
              :class="{ active: currentTab === tab.id }"
              @click="currentTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="settings-body">
            <display-settings v-if="currentTab === 'display'" />
            <vault-settings v-if="currentTab === 'vaults'" />
            <formatting-settings v-if="currentTab === 'formatting'" />
          </div>
        </div>
      </div>
    </modal>
  </portal>
</template>

<script lang="ts">
import Vue from 'vue'
import VaultSettings from './VaultSettings.vue'
import FormattingSettings from './FormattingSettings.vue'
import DisplaySettings from './DisplaySettings.vue'

export default Vue.extend({
  components: { VaultSettings, FormattingSettings, DisplaySettings },
  data() {
    return {
      currentTab: 'display' as string,
      tabs: [
        { id: 'display', label: 'Display' },
        { id: 'formatting', label: 'Formatting' },
        { id: 'vaults', label: 'Key Vaults' },
      ],
    }
  },
  methods: {
    open() {
      this.$modal.show('app-settings-modal')
    },
    close() {
      this.$modal.hide('app-settings-modal')
    },
  },
})
</script>

<style lang="scss" scoped>
.dialog-content {
  min-width: 520px;
}

.dialog-c-title {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .close-btn {
    margin-left: auto;
  }
}

.settings-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
  margin: 0.75rem 0 0;
}

.settings-tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--text-dark);
  margin-bottom: -1px;

  &:hover {
    color: var(--color-text);
  }

  &.active {
    color: var(--color-text);
    border-bottom-color: var(--theme-primary, #5881D8);
    font-weight: 500;
  }
}

.settings-body {
  padding: 1rem 0 0.5rem;
  max-height: 630px;
  overflow-y: auto;
}
</style>
