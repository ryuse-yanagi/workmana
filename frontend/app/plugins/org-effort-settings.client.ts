import { hydrateOrgEffortSettingsCacheFromSession } from '../composables/useOrgEffortSettings'

export default defineNuxtPlugin(() => {
  hydrateOrgEffortSettingsCacheFromSession()
})
