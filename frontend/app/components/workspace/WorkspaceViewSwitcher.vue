<template>
  <nav
    class="workspace-view-switcher"
    data-workspace-view-switcher-root
    aria-label="表示形式"
  >
    <NuxtLink
      v-for="view in views"
      :key="view.key"
      :to="view.to"
      class="workspace-view-switcher__tab"
      :class="{ 'workspace-view-switcher__tab--active': isViewSelected(view.key) }"
      :aria-current="isViewSelected(view.key) ? 'page' : undefined"
    >
      <span class="workspace-view-switcher__tab-label">{{ view.label }}</span>
    </NuxtLink>
  </nav>
</template>
<script setup lang="ts">
const props = defineProps<{
  orgSlug: string
  workspaceId: string
}>()
const { views, activeView } = useWorkspaceViewRoutes(
  () => props.orgSlug,
  () => props.workspaceId,
)
function isViewSelected (key: WorkspaceViewKey) {
  return activeView.value === key
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceViewSwitcher.scss"></style>
