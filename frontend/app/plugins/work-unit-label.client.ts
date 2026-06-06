import { hydrateWorkUnitLabelCacheFromSession } from '../composables/useOrgTerminology'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    hydrateWorkUnitLabelCacheFromSession()
  })
})
