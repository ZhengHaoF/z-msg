<script setup lang="ts">
import { chat } from '../stores/chat'
import { copyText } from '../lib/clipboard'
import { toast } from '../lib/toast'
import BaseModal from './BaseModal.vue'
import Icon from './Icon.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; clear: []; reset: [] }>()

async function copySession(): Promise<void> {
  const copied = await copyText(chat.session.id)
  if (copied) toast.success('会话码已复制')
  else toast.error('无法访问剪贴板，请手动复制')
}
</script>

<template>
  <BaseModal
    :open="open"
    title="设置"
    description="会话身份和聊天数据只保存在当前浏览器。"
    @close="emit('close')"
  >
    <section class="settings-section">
      <div class="settings-heading">
        <span class="settings-label">会话码</span>
        <span class="settings-note">重连后保持不变</span>
      </div>
      <div class="session-line">
        <code class="mono">{{ chat.session.id }}</code>
        <button class="icon-btn" type="button" aria-label="复制会话码" @click="copySession">
          <Icon name="copy" :size="16" />
        </button>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-heading">
        <span class="settings-label">本地数据</span>
      </div>
      <p class="hint">
        房间、口令派生出的密钥和聊天记录都保存在 localStorage。清除浏览器数据会同时丢失这些内容。
      </p>
      <div class="settings-actions">
        <button class="btn btn--ghost" type="button" @click="emit('clear')">清空聊天数据</button>
        <button class="btn btn--danger" type="button" @click="emit('reset')">重置会话身份</button>
      </div>
      <p class="hint">重置会话身份会生成新的会话码，并清空所有房间。</p>
    </section>

    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">关闭</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.settings-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.settings-label {
  font-size: 13px;
  font-weight: 700;
}

.settings-note {
  color: var(--text-faint);
  font-size: 12px;
}

.session-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.session-line code {
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
