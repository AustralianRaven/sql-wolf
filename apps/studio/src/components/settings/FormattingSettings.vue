<template>
  <div class="formatting-settings">
    <div class="setting-section-title">SQL Editor</div>

    <div class="form-group">
      <label for="keywordCase">Keyword Case in Autocomplete</label>
      <select
        id="keywordCase"
        class="form-control"
        :value="keywordCase"
        @change="saveKeywordCase($event.target.value)"
      >
        <option value="upper">UPPERCASE (SELECT, FROM, WHERE)</option>
        <option value="lower">lowercase (select, from, where)</option>
      </select>
      <small class="help text-muted">
        Controls the casing of SQL keywords suggested in the autocomplete dropdown.
      </small>
    </div>

    <div class="form-group">
      <label class="checkbox-group" for="autoQuote">
        <input
          id="autoQuote"
          class="form-control"
          type="checkbox"
          :checked="autoQuoteIdentifiers"
          @change="saveAutoQuote($event.target.checked)"
        />
        <span>Auto-quote identifiers</span>
      </label>
      <small class="help text-muted">
        When enabled, table and column names that contain special characters or
        reserved words are automatically wrapped in double quotes on autocomplete.
        Disable this if you prefer to handle quoting manually.
      </small>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'

export default Vue.extend({
  computed: {
    ...mapGetters({
      autocompleteUppercaseKeywords: 'settings/autocompleteUppercaseKeywords',
      autoQuoteIdentifiers: 'settings/autoQuoteIdentifiers',
    }),
    keywordCase(): string {
      return this.autocompleteUppercaseKeywords ? 'upper' : 'lower'
    },
  },
  methods: {
    async saveKeywordCase(value: string) {
      await this.$store.dispatch('settings/save', {
        key: 'autocompleteKeywordCase',
        value,
      })
    },
    async saveAutoQuote(value: boolean) {
      await this.$store.dispatch('settings/save', {
        key: 'autoQuoteIdentifiers',
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

.help {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.78rem;
  line-height: 1.4;
}
</style>
