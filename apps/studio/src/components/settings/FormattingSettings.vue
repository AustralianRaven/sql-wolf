<template>
  <div class="formatting-settings">
    <div class="setting-section-title">SQL Editor</div>

    <div class="form-group">
      <label for="keywordCase">Keyword Case in Autocomplete</label>
      <select
        id="keywordCase"
        class="form-control"
        :value="keywordCase"
        @change="saveSetting('autocompleteKeywordCase', $event.target.value)"
      >
        <option value="preserve">Match what you type (SEL &rarr; SELECT, sel &rarr; select)</option>
        <option value="upper">UPPERCASE (SELECT, FROM, WHERE)</option>
        <option value="lower">lowercase (select, from, where)</option>
      </select>
      <small class="help text-muted">
        Sets the casing of SQL keywords offered in the autocomplete dropdown.
      </small>
    </div>

    <div class="form-group">
      <label for="quoteIdentifiers">Identifier Quoting in Autocomplete</label>
      <select
        id="quoteIdentifiers"
        class="form-control"
        :value="quoteIdentifiers"
        @change="saveSetting('autocompleteQuoteIdentifiers', $event.target.value)"
      >
        <option value="auto">Only when required</option>
        <option value="always">Whenever the name is not all-lowercase</option>
      </select>
      <small class="help text-muted">
        Controls when a completed table or column name is wrapped in the dialect's quote
        character. "Only when required" quotes reserved words and names with special
        characters. The quote character itself comes from the database dialect.
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
      userKeywordCase: 'settings/autocompleteKeywordCase',
      userQuoteIdentifiers: 'settings/autocompleteQuoteIdentifiers',
    }),
    // Fall back to the same defaults the editor applies when nothing is saved.
    keywordCase(): string {
      return this.userKeywordCase || 'preserve'
    },
    quoteIdentifiers(): string {
      return this.userQuoteIdentifiers || 'auto'
    },
  },
  methods: {
    async saveSetting(key: string, value: string) {
      await this.$store.dispatch('settings/save', { key, value })
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
