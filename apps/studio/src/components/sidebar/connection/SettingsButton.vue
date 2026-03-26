<template>
  <div>
    <a
      class="nav-item settings-btn"
      title="Settings"
      @click.prevent="open"
    >
      <span class="avatar"><i class="material-icons">settings</i></span>
    </a>
    <settings-modal ref="modal" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import SettingsModal from '@/components/settings/SettingsModal.vue'

export default Vue.extend({
  components: { SettingsModal },
  methods: {
    open() {
      (this.$refs.modal as any).open()
    },
  },
})
</script>
