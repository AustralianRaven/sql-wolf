<template>
  <div class="display-settings">
    <div class="setting-section-title">Query Results</div>

    <div class="form-group">
      <label>Results Layout</label>
      <div class="radio-group">
        <label class="radio-option">
          <input
            type="radio"
            value="tabs"
            :checked="queryResultsLayout === 'tabs'"
            @change="saveLayout('tabs')"
          />
          <span>Tabs</span>
          <small class="help text-muted">Show one result at a time. Use the dropdown in the status bar to switch between results.</small>
        </label>
        <label class="radio-option">
          <input
            type="radio"
            value="stacked"
            :checked="queryResultsLayout === 'stacked'"
            @change="saveLayout('stacked')"
          />
          <span>Stacked</span>
          <small class="help text-muted">Display all result sets vertically, one table below the other.</small>
        </label>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'

export default Vue.extend({
  computed: {
    ...mapGetters({
      queryResultsLayout: 'settings/queryResultsLayout',
    }),
  },
  methods: {
    async saveLayout(value: string) {
      await this.$store.dispatch('settings/save', {
        key: 'queryResultsLayout',
        value,
      })
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

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-option {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.5rem;
  row-gap: 0.1rem;
  cursor: pointer;

  input[type="radio"] {
    grid-row: 1;
    grid-column: 1;
    margin-top: 0.2rem;
  }

  span {
    grid-row: 1;
    grid-column: 2;
    font-weight: 500;
  }

  .help {
    grid-row: 2;
    grid-column: 2;
    display: block;
    font-size: 0.78rem;
    line-height: 1.4;
  }
}
</style>
