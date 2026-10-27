<script setup lang="ts">
import BaseModal from './BaseModal.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmText?: string
    danger?: boolean
  }>(),
  { confirmText: '确认', danger: false },
)

const emit = defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="title" @close="emit('close')">
    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">取消</button>
      <button
        class="btn"
        :class="danger ? 'btn--danger' : 'btn--primary'"
        type="button"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-message {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}
</style>
