<template>
  <main class="page">
    <nav class="nav">
      <NuxtLink :to="`/org/${slug}`">← プロジェクト一覧</NuxtLink>
    </nav>
    <h1>プロジェクト #{{ projectId }}</h1>
    <p v-if="error" class="err">{{ error }}</p>
    <template v-else>
      <section>
        <h2>タスク</h2>
        <ul v-if="tasks?.length">
          <li v-for="t in tasks" :key="t.id">
            <strong>{{ t.title }}</strong>
            <span class="muted"> — {{ t.status }}</span>
          </li>
        </ul>
        <p v-else class="muted">タスクがありません。</p>
        <form class="card" @submit.prevent="createTask">
          <input v-model="newTitle" type="text" required placeholder="タスク名" />
          <button type="submit" :disabled="pending">追加</button>
        </form>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { useApi } from '../../../../composables/useApi'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const projectId = computed(() => route.params.id as string)
const { api } = useApi()

const tasks = ref<{ id: number; title: string; status: string }[] | null>(null)
const error = ref<string | null>(null)
const newTitle = ref('')
const pending = ref(false)

async function load () {
  error.value = null
  try {
    const res = await api<{ data: { id: number; title: string; status: string }[] }>(
      `/orgs/${slug.value}/projects/${projectId.value}/tasks`,
    )
    tasks.value = res.data
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  }
}

async function createTask () {
  pending.value = true
  try {
    await api(`/orgs/${slug.value}/projects/${projectId.value}/tasks`, {
      method: 'POST',
      body: { title: newTitle.value },
    })
    newTitle.value = ''
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
