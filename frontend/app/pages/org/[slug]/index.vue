<template>
  <main class="page">
    <nav class="nav">
      <NuxtLink to="/">← ホーム</NuxtLink>
    </nav>
    <h1>組織: {{ slug }}</h1>
    <p v-if="error" class="err">{{ error }}</p>
    <section v-else>
      <h2>プロジェクト</h2>
      <ul v-if="projects?.length">
        <li v-for="p in projects" :key="p.id">
          <NuxtLink :to="`/org/${slug}/projects/${p.id}`">{{ p.name }}</NuxtLink>
        </li>
      </ul>
      <p v-else class="muted">プロジェクトがありません。</p>
      <form class="card" @submit.prevent="createProject">
        <input v-model="newProjectName" type="text" required placeholder="新規プロジェクト名" />
        <button type="submit" :disabled="pending">作成</button>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useApi } from '../../../composables/useApi'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { api } = useApi()

const projects = ref<{ id: number; name: string }[] | null>(null)
const error = ref<string | null>(null)
const newProjectName = ref('')
const pending = ref(false)

async function load () {
  error.value = null
  try {
    const res = await api<{ data: { id: number; name: string }[] }>(`/orgs/${slug.value}/projects`)
    projects.value = res.data
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  }
}

async function createProject () {
  pending.value = true
  try {
    await api(`/orgs/${slug.value}/projects`, {
      method: 'POST',
      body: { name: newProjectName.value },
    })
    newProjectName.value = ''
    await load()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; }
.nav { margin-bottom: 1rem; }
.muted { color: #64748b; }
.err { color: #b91c1c; }
.card { margin-top: 1rem; display: flex; gap: 0.5rem; }
.card input { flex: 1; padding: 0.5rem; }
button { padding: 0.5rem 1rem; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; }
button:disabled { opacity: 0.5; }
ul { padding-left: 1.2rem; }
</style>
