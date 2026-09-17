import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from '../lib/queryClient'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
})
