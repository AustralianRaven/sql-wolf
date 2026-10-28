<template>
  <div class="html-preview">
    <div class="html-preview-toolbar">
      <span class="title">{{ tab.title }}</span>
      <span class="expand" />
      <x-button
        class="btn btn-flat btn-small"
        @click.prevent="format"
        title="Re-indent the raw HTML"
      >
        <x-label>Format</x-label>
      </x-button>
      <x-button
        class="btn btn-flat btn-small"
        :class="{ active: wrapText }"
        @click.prevent="wrapText = !wrapText"
      >
        <x-label>Wrap</x-label>
      </x-button>
      <x-button
        class="btn btn-flat btn-small"
        :class="{ active: blockRemote }"
        @click.prevent="blockRemote = !blockRemote"
        title="Block remote images, stylesheets and fonts in the preview"
      >
        <x-label>Block remote content</x-label>
      </x-button>
      <x-button
        class="btn btn-flat btn-small"
        @click.prevent="copy"
      >
        <x-label>Copy HTML</x-label>
      </x-button>
    </div>
    <div class="html-preview-panes">
      <div
        class="html-preview-source"
        ref="source"
      >
        <text-editor
          :value="html"
          language-id="html"
          :line-wrapping="wrapText"
          @bks-value-change="onSourceChange"
        />
      </div>
      <div
        class="html-preview-render"
        ref="render"
      >
        <!-- sandbox="" with no allow-* tokens: no scripts, forms, popups or navigation -->
        <iframe
          sandbox=""
          referrerpolicy="no-referrer"
          :srcdoc="renderedHtml"
          title="HTML preview"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue'
import _ from 'lodash'
import Split from 'split.js'
import TextEditor from '@beekeeperstudio/ui-kit/vue/text-editor'
import { Languages } from '@/lib/editor/languageData'
import { TransportOpenTab } from '@/common/transport/TransportOpenTab'

const htmlLanguage = Languages.find((lang) => lang.name === 'html')

// Injected ahead of the document so a <meta> CSP in the content cannot loosen it.
const blockRemoteCsp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:">`

export default Vue.extend({
  components: { TextEditor },
  props: {
    tab: {
      type: Object as PropType<TransportOpenTab>,
      required: true,
    },
    active: Boolean,
  },
  data() {
    return {
      html: this.tab.unsavedQueryText || '',
      renderedSource: this.tab.unsavedQueryText || '',
      wrapText: true,
      blockRemote: false,
      split: null,
    }
  },
  computed: {
    renderedHtml(): string {
      return this.blockRemote ? blockRemoteCsp + this.renderedSource : this.renderedSource
    },
  },
  methods: {
    onSourceChange({ value }: { value: string }) {
      if (value === this.html) return
      this.html = value
      this.updatePreview()
    },
    updatePreview: _.debounce(function () {
      this.renderedSource = this.html
      const tab = { ...this.tab, unsavedQueryText: this.html }
      this.$emit('update-tab', tab)
      this.$store.dispatch('tabs/save', tab)
    }, 300),
    format() {
      this.html = htmlLanguage.beautify(this.html).trim()
      this.updatePreview()
    },
    copy() {
      this.$copyText(this.html)
      this.$noty.success('HTML copied to clipboard')
    },
  },
  mounted() {
    this.split = Split([this.$refs.source, this.$refs.render], {
      elementStyle: (_dimension, size) => ({
        'flex-basis': `calc(${size}%)`,
      }),
      sizes: [50, 50],
      gutterSize: 8,
      minSize: 100,
    })
  },
  beforeDestroy() {
    this.updatePreview.flush()
    this.split?.destroy()
  },
})
</script>

<style lang="scss" scoped>
.html-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.html-preview-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--border-color);

  .title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .expand {
    flex: 1;
  }

  .active {
    color: var(--theme-primary);
  }
}

.html-preview-panes {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
}

.html-preview-source,
.html-preview-render {
  min-width: 0;
  overflow: hidden;
}

.html-preview-source {
  display: flex;
  flex-direction: column;

  // The ui-kit wrapper sits between this pane and .BksTextEditor.
  > * {
    flex: 1;
    min-height: 0;
  }

  ::v-deep .BksTextEditor,
  ::v-deep .cm-editor {
    height: 100%;
  }
}

.html-preview-render {
  border-left: 1px solid var(--border-color);
}

.html-preview-render iframe {
  width: 100%;
  height: 100%;
  border: 0;
  // Email and report HTML assumes a white page; theme colours would wreck it.
  background: #fff;
}
</style>
