import DefaultTheme from 'vitepress/theme'
import PkaConverter from './components/PkaConverter.vue'
import './custom.css'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PkaConverter', PkaConverter)
  },
} satisfies Theme
