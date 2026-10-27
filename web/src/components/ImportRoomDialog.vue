<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Room } from '../types'
import { importRoom } from '../stores/chat'
import { MIN_PASSPHRASE_LENGTH } from '../lib/crypto'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [room: Room] }>()

const inviteCode = ref('')
const passphrase = ref('')
const error = ref('')
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    inviteCode.value = ''
    passphrase.value = ''
    error.value = ''
    busy.value = false
  },
)

async function submit(): Promise<void> {
  error.value = ''
  if (!inviteCode.value.trim()) {
    error.value = '请输入邀请码'
    return
  }
  if (passphrase.value.length < MIN_PASSPHRASE_LENGTH) {
    error.value = `口令至少 ${MIN_PASSPHRASE_LENGTH} 位`
    return
  }

  busy.value = true
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  try {
    emit('imported', importRoom(inviteCode.value, passphrase.value))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '导入邀请失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="导入邀请"
    description="粘贴对方发来的邀请码，并输入双方约定的口令。"
    @close="emit('close')"
  >
    <form id="import-room-form" class="dialog-form" @submit.prevent="submit">
      <label class="field" for="import-room-code">
        <span class="field-label">邀请码</span>
        <textarea
          id="import-room-code"
          v-model="inviteCode"
          class="textarea mono"
          rows="3"
          spellcheck="false"
          placeholder="粘贴邀请码"
        />
      </label>
      <label class="field" for="import-room-passphrase">
        <span class="field-label">双方约定口令</span>
        <input
          id="import-room-passphrase"
          v-model="passphrase"
          class="input"
          type="password"
          autocomplete="off"
          placeholder="至少 6 位"
        />
      </label>
      <p class="hint">邀请码不包含口令，请通过其他渠道向对方确认口令。</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    </form>

    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">取消</button>
      <button class="btn btn--primary" type="submit" form="import-room-form" :disabled="busy">
        {{ busy ? '加入中…' : '加入房间' }}
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
