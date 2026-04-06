import DefaultTheme from 'vitepress/theme'
import PkaConverter from './components/PkaConverter.vue'
import PkaPatcher from './components/PkaPatcher.vue'
import PkaTraceCleaner from './components/PkaTraceCleaner.vue'
import AssessmentItems from './components/AssessmentItems.vue'
import './custom.css'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PkaConverter', PkaConverter)
    app.component('PkaPatcher', PkaPatcher)
    app.component('PkaTraceCleaner', PkaTraceCleaner)
    app.component('AssessmentItems', AssessmentItems)
  },
} satisfies Theme
