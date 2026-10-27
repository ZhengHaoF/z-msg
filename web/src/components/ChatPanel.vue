<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { MessageStatus, Room } from '../types'
import { chat, sendText } from '../stores/chat'
import { avatarColor, roomInitial } from '../lib/avatar'
import type { IconName } from '../lib/icons'
import Icon from './Icon.vue'

const props = defineProps<{ room: Room }>()
const emit = defineEmits<{ back: []; share: [] }>()

const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const atBottom = ref(true)

const messages = computed(() => chat.messages[props.room.id] ?? [])
const canSend = computed(() => Boolean(props.room.peerId))
const peerLabel = computed(() =>
  props.room.peerId ? `端到端加密 · ${props.room.peerId.slice(0, 8)}` : '等待对方加入',
)
const connectionText = computed(() => {
  if (chat.socketStatus === 'connecting') return '正在连接服务器…'
  if (chat.socketStatus === 'offline') return '连接已断开，正在重连；消息会在恢复后发送'
  return ''
})

const statusLabels: Record<MessageStatus, string> = {
  pending: '发送中',
  delivered: '已送达',
  queued: '对方离线，已排队',
  failed: '发送失败',
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' })

function statusIcon(status: MessageStatus): IconName {
  if (status === 'delivered') return 'check'
  if (status === 'failed') return 'alert'
  return 'clock'
}

function formatTime(at: number): string {
  return timeFormatter.format(new Date(at))
}

function formatTitle(at: number): string {
  return new Date(at).toLocaleString('zh-CN')
}

function scrollToBottom(): void {
  const element = messagesEl.value
  if (!element) return
  element.scrollTop = element.scrollHeight
  atBottom.value = true
}

function onScroll(): void {
  const element = messagesEl.value
  if (!element) return
  atBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < 80
}

function resize(): void {
  const element = textareaEl.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 120)}px`
}

function submit(): void {
  if (!canSend.value || !draft.value.trim()) return
  if (!sendText(draft.value)) return
  draft.value = ''
  nextTick(() => {
    resize()
    scrollToBottom()
    textareaEl.value?.focus()
  })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    if (atBottom.value) scrollToBottom()
  },
)

watch(
  () => props.room.id,
  async () => {
    draft.value = ''
    atBottom.value = true
    await nextTick()
    resize()
    scrollToBottom()
  },
)

onMounted(async () => {
  await nextTick()
  scrollToBottom()
})
</script>

<template>
  <section class="panel" :aria-label="`聊天室 ${room.name}`">
    <header class="panel-header">
      <button class="icon-btn back-btn" type="button" aria-label="返回房间列表" @click="emit('back')">
        <Icon name="back" :size="20" />
      </button>
      <span class="room-avatar" :style="{ background: avatarColor(room.id) }">
        {{ roomInitial(room.name) }}
      </span>
      <div class="header-main">
        <h2>{{ room.name }}</h2>
        <p>{{ peerLabel }}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn--ghost btn--sm" type="button" @click="emit('share')">
          <Icon name="share" :size="15" />
          分享邀请码
        </button>
      </div>
    </header>

    <div v-if="chat.socketStatus !== 'online'" class="connection-banner">
      <Icon name="wifi" :size="14" />
      {{ connectionText }}
    </div>

    <div class="panel-body">
      <div ref="messagesEl" class="messages" @scroll.passive="onScroll">
        <div class="messages-inner">
          <template v-for="message in messages" :key="message.id">
            <div
              v-if="message.direction === 'system'"
              class="system-row"
              data-testid="system-message"
            >
              {{ message.text }}
            </div>
            <div
              v-else
              class="message-row"
              :class="message.direction"
              data-testid="message"
            >
              <div class="bubble-wrap">
                <div class="bubble">{{ message.text }}</div>
                <div class="message-meta">
                  <span :title="formatTitle(message.at)">{{ formatTime(message.at) }}</span>
                  <span
                    v-if="message.direction === 'out' && message.status"
                    class="message-status"
                    :class="message.status"
                    :aria-label="statusLabels[message.status]"
                  >
                    <Icon :name="statusIcon(message.status)" :size="12" />
                    <span v-if="message.status !== 'delivered'">
                      {{ statusLabels[message.status] }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </template>

          <div v-if="!messages.length" class="messages-empty">
            <Icon name="lock" :size="30" />
            <p>{{ room.peerId ? '还没有消息，说点什么吧' : '等待对方加入后开始聊天' }}</p>
          </div>
        </div>
      </div>

      <button
        v-if="!atBottom"
        class="scroll-bottom"
        type="button"
        aria-label="回到底部"
        @click="scrollToBottom"
      >
        <Icon name="arrowDown" :size="18" />
      </button>

      <div class="composer">
        <div v-if="!room.peerId" class="waiting-card">
          <div class="waiting-icon">
            <Icon name="share" :size="18" />
          </div>
          <p>把邀请码发给对方，对方导入后即可开始聊天。</p>
          <button class="btn btn--primary btn--sm" type="button" @click="emit('share')">
            分享邀请码
          </button>
        </div>

        <div class="composer-inner">
          <textarea
            ref="textareaEl"
            v-model="draft"
            rows="1"
            :disabled="!canSend"
            :placeholder="canSend ? '输入消息，Enter 发送' : '等待对方加入…'"
            aria-label="消息输入框"
            @input="resize"
            @keydown="onKeydown"
          />
          <button
            class="send-btn"
            type="button"
            :disabled="!canSend || !draft.trim()"
            aria-label="发送"
            @click="submit"
          >
            <Icon name="send" :size="18" />
          </button>
        </div>
        <p class="composer-hint">Enter 发送，Shift + Enter 换行</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
}

.back-btn {
  display: none;
  margin-left: -6px;
}

.room-avatar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  flex: none;
}

.header-main {
  flex: 1;
  min-width: 0;
}

.header-main h2 {
  margin: 0;
  overflow: hidden;
  font-size: 16px;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-main p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--text-faint);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 6px;
}

.connection-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border-bottom: 1px solid #fde68a;
  background: var(--warning-soft);
  color: #92400e;
  font-size: 12px;
}

.panel-body {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.messages {
  flex: 1;
  min-height: 0;
  padding: 24px 24px 8px;
  overflow-y: auto;
  background: radial-gradient(800px 400px at 50% -10%, rgba(37, 99, 235, 0.05), transparent 70%);
}

.messages-inner {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 760px;
  min-height: 100%;
  margin: 0 auto;
}

.message-row {
  display: flex;
}

.message-row.out {
  justify-content: flex-end;
}

.bubble-wrap {
  display: flex;
  flex-direction: column;
  max-width: 72%;
}

.message-row.out .bubble-wrap {
  align-items: flex-end;
}

.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-row.in .bubble {
  border: 1px solid var(--border);
  border-bottom-left-radius: 6px;
  background: var(--surface-muted);
}

.message-row.out .bubble {
  border-bottom-right-radius: 6px;
  background: var(--accent);
  color: #fff;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.18);
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  color: var(--text-faint);
  font-size: 11px;
}

.message-row.out .message-meta {
  color: rgba(255, 255, 255, 0.72);
}

.message-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.message-status.failed {
  color: #7f1d1d;
  font-weight: 600;
}

.message-row.out .message-status.failed {
  color: #fecaca;
}

.system-row {
  align-self: center;
  max-width: 80%;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-faint);
  font-size: 12px;
  text-align: center;
}

.messages-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
}

.messages-empty p {
  margin: 0;
}

.scroll-bottom {
  position: absolute;
  right: 24px;
  bottom: 104px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.scroll-bottom:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
}

.composer {
  padding: 12px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.waiting-card {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 760px;
  margin: 0 auto 12px;
  padding: 11px 13px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.waiting-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  flex: none;
}

.waiting-card p {
  flex: 1;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.composer-inner {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  max-width: 760px;
  margin: 0 auto;
  padding: 7px 7px 7px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-muted);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.composer-inner:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.composer textarea {
  flex: 1;
  min-height: 26px;
  max-height: 120px;
  padding: 8px 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
}

.composer textarea:disabled {
  cursor: not-allowed;
}

.send-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: var(--accent);
  color: #fff;
  flex: none;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.send-btn:disabled {
  background: var(--border-strong);
  cursor: not-allowed;
}

.composer-hint {
  max-width: 760px;
  margin: 7px auto 0;
  color: var(--text-faint);
  font-size: 11px;
  text-align: right;
}

@media (max-width: 840px) {
  .back-btn {
    display: inline-flex;
  }

  .panel-header {
    padding: 10px 14px;
  }

  .messages {
    padding: 18px 14px 8px;
  }

  .bubble-wrap {
    max-width: 82%;
  }

  .composer {
    padding: 10px 14px calc(12px + env(safe-area-inset-bottom));
  }

  .header-actions .btn {
    padding: 0 9px;
  }

  .scroll-bottom {
    right: 16px;
    bottom: 112px;
  }
}
</style>
