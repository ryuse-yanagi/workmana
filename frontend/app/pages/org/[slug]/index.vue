<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string
await navigateTo(`/org/${slug}/workspaces`, { replace: true })
</script>
