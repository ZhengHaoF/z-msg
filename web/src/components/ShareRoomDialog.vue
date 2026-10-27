<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Room } from '../types'
import { inviteCodeFor } from '../stores/chat'
import { copyText } from '../lib/clipboard'
import { toast } from '../lib/toast'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ open: boolean; room: Room | null }>()
const emit = defineEmits<{ close: [] }>()

const copied = ref(false)

const inviteCode = computed(() => (props.room ? inviteCodeFor(props.room) : ''))
const hasPeer = computed(() => Boolean(props.room?.peerId))

watch(
  () => props.open,
  (open) => {
    if (open) copied.value = false
  },
)

function selectInvite(event: FocusEvent): void {
  const target = event.target
  if (target instanceof HTMLTextAreaElement) target.select()
}

async function copyInvite(): Promise<void> {
  const copiedOk = await copyText(inviteCode.value)
  if (!copiedOk) {
    toast.error('无法访问剪贴板，请手动复制')
    return
  }
  copied.value = true
  toast.success('邀请码已复制')
}
</script>

<template>
  <BaseModal
    :open="open && Boolean(room)"
    title="分享邀请码"
    description="对方导入邀请码并输入相同口令后，就可以开始加密聊天。"
    @close="emit('close')"
  >
    <div v-if="room" class="share-body">
      <div class="share-status" :class="{ ready: hasPeer }">
        {{ hasPeer ? '对方已加入这个会话' : '等待对方导入邀请码' }}
      </div>
      <label class="field" for="share-invite-code">
        <span class="field-label">邀请码</span>
        <textarea
          id="share-invite-code"
          class="textarea mono"
          rows="3"
          readonly
          data-testid="invite-code"
          :value="inviteCode"
          @focus="selectInvite"
        />
      </label>
      <p class="hint warning">
        邀请码不包含口令。请通过其他渠道（当面、电话等）单独告知对方口令，不要和邀请码一起发送。
      </p>
    </div>

    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">关闭</button>
      <button class="btn btn--primary" type="button" @click="copyInvite">
        {{ copied ? '已复制' : '复制邀请码' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.share-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.share-status {
  align-self: flex-start;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 12px;
}

.share-status.ready {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.warning {
  padding: 10px 12px;
  border: 1px solid #fde68a;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: #92400e;
}
</style>
