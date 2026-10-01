<script setup lang="ts">
/** 組織の直下はスペース一覧へ戻す */
const route = useRoute()
const slug = route.params.slug as string
await navigateTo(`/org/${slug}/workspaces`, { replace: true })
</script>
