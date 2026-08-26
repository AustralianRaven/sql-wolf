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

    <div class="form-group" v-if="queryResultsLayout === 'stacked'">
      <label for="stackedMaxHeight">Maximum Result Height</label>
      <div class="max-height-row">
        <input
          id="stackedMaxHeight"
          type="number"
          class="form-control max-height-input"
          min="100"
          max="2000"
          step="50"
          :value="stackedResultMaxHeight"
          @change="saveMaxHeight($event.target.value)"
        />
        <span class="unit">px</span>
        <button
          class="btn btn-flat reset-btn"
          :disabled="stackedResultMaxHeight === defaultMaxHeight"
          @click.prevent="saveMaxHeight(defaultMaxHeight)"
        >
          Reset
        </button>
      </div>
      <small class="help text-muted">
        Each stacked table grows to fit its rows and stops here, scrolling beyond
        it. Small results stay small; large ones stay usable. Between 100 and
        2000 pixels.
      </small>
    </div>

    <div class="setting-section-title">Accent Color</div>

    <div class="form-group">
      <label>Color</label>
      <div class="accent-color-row">
        <input
          type="color"
          class="color-input"
          :value="accentColorValue"
          @input="onColorInput"
          @change="onColorChange"
        />
        <span class="color-hex">{{ accentColorValue }}</span>
        <button
          class="btn btn-flat reset-btn"
          :disabled="!accentColor"
          @click="resetAccentColor"
        >
          Reset
        </button>
      </div>
      <small class="help text-muted">
        Overrides the theme's accent color. Used for active tab indicators, highlights, and other accents.
      </small>
    </div>

    <div class="form-group">
      <label>Presets</label>
      <div class="color-presets">
        <button
          v-for="preset in colorPresets"
          :key="preset.hex"
          class="color-swatch"
          :class="{ active: accentColorValue === preset.hex }"
          :style="{ background: preset.hex }"
          :title="preset.label"
          @click="applyPreset(preset.hex)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { mapGetters } from 'vuex'

const THEME_DEFAULT = '#fad83b'

export default Vue.extend({
  data() {
    return {
      pendingColor: null as string | null,
      defaultMaxHeight: 400,
      colorPresets: [
        { label: 'Yellow (default)', hex: '#fad83b' },
        { label: 'Blue',   hex: '#5881D8' },
        { label: 'Cyan',   hex: '#4ad0ff' },
        { label: 'Green',  hex: '#3ddc84' },
        { label: 'Red',    hex: '#ff4757' },
        { label: 'Purple', hex: '#a855f7' },
        { label: 'Orange', hex: '#ff6b2b' },
      ],
    }
  },
  computed: {
    ...mapGetters({
      queryResultsLayout: 'settings/queryResultsLayout',
      accentColor: 'settings/accentColor',
      stackedResultMaxHeight: 'settings/stackedResultMaxHeight',
    }),
    accentColorValue(): string {
      return this.pendingColor ?? this.accentColor ?? THEME_DEFAULT
    },
  },
  methods: {
    async saveLayout(value: string) {
      await this.$store.dispatch('settings/save', {
        key: 'queryResultsLayout',
        value,
      })
    },
    async saveMaxHeight(raw: string | number) {
      // Clamped here as well as in the getter, so a typed-in value is stored
      // already corrected rather than being reinterpreted on every read.
      const parsed = parseInt(String(raw), 10)
      const value = Number.isNaN(parsed)
        ? this.defaultMaxHeight
        : Math.min(Math.max(parsed, 100), 2000)
      await this.$store.dispatch('settings/save', {
        key: 'stackedResultMaxHeight',
        value,
      })
    },
    onColorInput(e: Event) {
      const value = (e.target as HTMLInputElement).value
      this.pendingColor = value
      document.body.style.setProperty('--theme-primary', value)
    },
    async onColorChange(e: Event) {
      const value = (e.target as HTMLInputElement).value
      this.pendingColor = null
      await this.$store.dispatch('settings/save', { key: 'accentColor', value })
    },
    async applyPreset(hex: string) {
      this.pendingColor = null
      await this.$store.dispatch('settings/save', { key: 'accentColor', value: hex })
    },
    async resetAccentColor() {
      this.pendingColor = null
      await this.$store.dispatch('settings/save', { key: 'accentColor', value: null })
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

  & + .form-group {
    margin-top: 0.75rem;
  }
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
  }
}

.accent-color-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.max-height-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.max-height-input {
  width: 6rem;
}

.unit {
  font-size: 0.8rem;
  color: var(--text-dark);
}

.color-input {
  width: 2.4rem;
  height: 2.4rem;
  padding: 0.1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

.color-hex {
  font-size: 0.85rem;
  font-family: monospace;
  color: var(--text);
  min-width: 5rem;
}

.reset-btn {
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
  margin-left: auto;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.color-presets {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.color-swatch {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;

  &:hover {
    transform: scale(1.15);
  }

  &.active {
    border-color: var(--text);
  }
}

.help {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--text-light);
}

.form-group {
  margin-bottom: 1.25rem;

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.4rem;
    font-size: 0.875rem;
  }
}
</style>
