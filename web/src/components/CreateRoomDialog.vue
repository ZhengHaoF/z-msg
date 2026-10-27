<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Room } from '../types'
import { createRoom } from '../stores/chat'
import { MIN_PASSPHRASE_LENGTH } from '../lib/crypto'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [room: Room] }>()

const name = ref('')
const passphrase = ref('')
const confirmPassphrase = ref('')
const error = ref('')
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = ''
    passphrase.value = ''
    confirmPassphrase.value = ''
    error.value = ''
    busy.value = false
  },
)

async function submit(): Promise<void> {
  error.value = ''
  if (!name.value.trim()) {
    error.value = '请输入房间名称'
    return
  }
  if (passphrase.value.length < MIN_PASSPHRASE_LENGTH) {
    error.value = `口令至少 ${MIN_PASSPHRASE_LENGTH} 位`
    return
  }
  if (passphrase.value !== confirmPassphrase.value) {
    error.value = '两次输入的口令不一致'
    return
  }

  busy.value = true
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  try {
    emit('created', createRoom(name.value, passphrase.value))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '创建房间失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="创建房间"
    description="为这个会话起个名字，并约定一个只有双方知道的口令。"
    @close="emit('close')"
  >
    <form id="create-room-form" class="dialog-form" @submit.prevent="submit">
      <label class="field" for="create-room-name">
        <span class="field-label">房间名称</span>
        <input
          id="create-room-name"
          v-model="name"
          class="input"
          type="text"
          maxlength="48"
          autocomplete="off"
          placeholder="例如：项目讨论"
        />
      </label>
      <label class="field" for="create-room-passphrase">
        <span class="field-label">双方约定口令</span>
        <input
          id="create-room-passphrase"
          v-model="passphrase"
          class="input"
          type="password"
          autocomplete="new-password"
          placeholder="至少 6 位"
        />
      </label>
      <label class="field" for="create-room-passphrase-confirm">
        <span class="field-label">确认口令</span>
        <input
          id="create-room-passphrase-confirm"
          v-model="confirmPassphrase"
          class="input"
          type="password"
          autocomplete="new-password"
          placeholder="再次输入口令"
        />
      </label>
      <p class="hint">口令只用于在本机派生加密密钥，不会发送给服务器。</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    </form>

    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">取消</button>
      <button class="btn btn--primary" type="submit" form="create-room-form" :disabled="busy">
        {{ busy ? '创建中…' : '创建房间' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
