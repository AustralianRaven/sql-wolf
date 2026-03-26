<template>
  <portal to="modals">
    <modal
      name="app-settings-modal"
      class="vue-dialog beekeeper-modal app-settings-modal"
      height="auto"
      :scrollable="true"
      :max-height="600"
    >
      <div v-kbd-trap="true">
        <div class="dialog-content">
          <div class="dialog-c-title">
            Settings
            <a class="close-btn btn btn-fab" href="#" @click.prevent="close">
              <i class="material-icons">clear</i>
            </a>
          </div>
          <div class="settings-body">
            <azure-vault-settings />
          </div>
        </div>
      </div>
    </modal>
  </portal>
</template>

<script lang="ts">
import Vue from 'vue'
import AzureVaultSettings from './AzureVaultSettings.vue'

export default Vue.extend({
  components: { AzureVaultSettings },
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

.settings-body {
  padding: 1rem 0 0.5rem;
  max-height: 520px;
  overflow-y: auto;
}
</style>
