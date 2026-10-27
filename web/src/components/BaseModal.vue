<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
}>()

const emit = defineEmits<{ close: [] }>()

const card = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    event.stopPropagation()
    emit('close')
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      card.value?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      previousFocus?.focus()
      previousFocus = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
        <div ref="card" class="modal-card" role="dialog" aria-modal="true" :aria-label="title">
          <header class="modal-header">
            <div class="modal-heading">
              <h2>{{ title }}</h2>
              <p v-if="description">{{ description }}</p>
            </div>
            <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
              <Icon name="close" :size="18" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.44);
  backdrop-filter: blur(5px);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  max-height: calc(100dvh - 40px);
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 20px 0;
}

.modal-heading {
  flex: 1;
  min-width: 0;
}

.modal-heading h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.01em;
}

.modal-heading p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
