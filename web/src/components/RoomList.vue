<script setup lang="ts">
import { computed } from 'vue'
import type { Room } from '../types'
import { chat, selectRoom } from '../stores/chat'
import { avatarColor, roomInitial } from '../lib/avatar'
import { copyText } from '../lib/clipboard'
import { toast } from '../lib/toast'
import Icon from './Icon.vue'

const emit = defineEmits<{
  create: []
  importInvite: []
  share: [roomId: string]
  remove: [roomId: string]
  settings: []
  select: []
}>()

const statusText = computed(() => {
  if (chat.socketStatus === 'online') return '已连接'
  if (chat.socketStatus === 'connecting') return '连接中'
  return '已断开'
})

function choose(room: Room): void {
  selectRoom(room.id)
  emit('select')
}

async function copySession(): Promise<void> {
  const copied = await copyText(chat.session.id)
  if (copied) toast.success('会话码已复制')
  else toast.error('无法访问剪贴板，请手动复制')
}
</script>

<template>
  <aside class="sidebar-inner" aria-label="房间列表">
    <header class="brand">
      <div class="logo" aria-hidden="true">
        <Icon name="lock" :size="22" />
      </div>
      <div class="brand-text">
        <h1>Z-Msg</h1>
        <p>端到端加密聊天</p>
      </div>
      <div class="brand-spacer" />
      <span class="status-pill" :class="chat.socketStatus">
        <span class="dot" />
        {{ statusText }}
      </span>
      <button class="icon-btn" type="button" aria-label="设置" @click="emit('settings')">
        <Icon name="settings" :size="18" />
      </button>
    </header>

    <section class="session-card" aria-label="我的会话码">
      <span class="session-label">
        <Icon name="key" :size="14" />
        我的会话码
      </span>
      <span class="session-code mono" :title="chat.session.id">{{ chat.session.id }}</span>
      <div class="session-actions">
        <button class="btn btn--ghost btn--sm" type="button" @click="copySession">
          <Icon name="copy" :size="14" />
          复制
        </button>
      </div>
    </section>

    <div class="room-list">
      <div
        v-for="room in chat.rooms"
        :key="room.id"
        class="room-item"
        :class="{ active: room.id === chat.activeRoomId }"
      >
        <button class="room-select" type="button" @click="choose(room)">
          <span class="room-avatar" :style="{ background: avatarColor(room.id) }">
            {{ roomInitial(room.name) }}
          </span>
          <span class="room-main">
            <span class="room-name">{{ room.name }}</span>
            <span class="room-sub">{{ room.peerId ? '端到端加密会话' : '等待对方加入' }}</span>
          </span>
          <span v-if="room.unread" class="unread" :aria-label="`${room.unread} 条未读消息`">
            {{ room.unread > 99 ? '99+' : room.unread }}
          </span>
        </button>
        <div class="room-actions">
          <button
            class="icon-btn"
            type="button"
            :aria-label="`分享 ${room.name} 的邀请码`"
            @click="emit('share', room.id)"
          >
            <Icon name="share" :size="16" />
          </button>
          <button
            class="icon-btn icon-btn--danger"
            type="button"
            :aria-label="`删除 ${room.name}`"
            @click="emit('remove', room.id)"
          >
            <Icon name="trash" :size="16" />
          </button>
        </div>
      </div>

      <div v-if="!chat.rooms.length" class="rooms-empty">
        <Icon name="lock" :size="28" />
        <p>还没有房间<br />创建一个房间并把邀请码发给对方</p>
      </div>
    </div>

    <footer class="sidebar-footer">
      <button class="btn btn--primary" type="button" @click="emit('create')">
        <Icon name="plus" :size="16" />
        创建房间
      </button>
      <button class="btn btn--ghost" type="button" @click="emit('importInvite')">
        <Icon name="download" :size="16" />
        导入邀请
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar-inner {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 20px 18px 12px;
}

.logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.28);
  flex: none;
}

.brand-text h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.02em;
}

.brand-text p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-faint);
}

.brand-spacer {
  flex: 1;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.status-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
}

.status-pill.online .dot {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.14);
}

.status-pill.connecting .dot {
  background: var(--warning);
  animation: pulse 1.2s infinite;
}

.status-pill.offline .dot {
  background: var(--danger);
}

.session-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 16px 14px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.session-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.session-code {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-actions {
  display: flex;
  justify-content: flex-end;
}

.room-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  padding: 4px 12px 12px;
  overflow-y: auto;
}

.room-item {
  display: flex;
  align-items: center;
  border-radius: var(--radius-md);
  transition: background 0.15s ease;
}

.room-item:hover {
  background: var(--surface-muted);
}

.room-item.active {
  background: var(--accent-soft);
}

.room-select {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  text-align: left;
}

.room-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  flex: none;
}

.room-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.room-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-sub {
  overflow: hidden;
  color: var(--text-faint);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread {
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex: none;
}

.room-actions {
  display: flex;
  gap: 2px;
  padding-right: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.room-item:hover .room-actions,
.room-item:focus-within .room-actions {
  opacity: 1;
}

.room-actions .icon-btn {
  width: 30px;
  height: 30px;
}

.rooms-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 16px;
  color: var(--text-faint);
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}

.rooms-empty p {
  margin: 0;
}

.sidebar-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
}

@media (hover: none) {
  .room-actions {
    opacity: 1;
  }
}
</style>
