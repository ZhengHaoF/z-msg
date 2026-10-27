<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Room } from '../types'
import {
  chat,
  clearRooms,
  deleteRoom,
  resetIdentity,
  startChat,
  stopChat,
} from '../stores/chat'
import RoomList from '../components/RoomList.vue'
import ChatPanel from '../components/ChatPanel.vue'
import CreateRoomDialog from '../components/CreateRoomDialog.vue'
import ImportRoomDialog from '../components/ImportRoomDialog.vue'
import ShareRoomDialog from '../components/ShareRoomDialog.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import Icon from '../components/Icon.vue'

const activeRoom = computed<Room | null>(
  () => chat.rooms.find((room) => room.id === chat.activeRoomId) ?? null,
)
const mobilePane = ref<'list' | 'chat'>('list')

const createOpen = ref(false)
const importOpen = ref(false)
const shareOpen = ref(false)
const settingsOpen = ref(false)
const shareRoom = ref<Room | null>(null)
const deleteTarget = ref<Room | null>(null)
const confirmClear = ref(false)
const confirmReset = ref(false)

watch(activeRoom, (room) => {
  if (!room) mobilePane.value = 'list'
})

onMounted(() => {
  startChat()
  if (activeRoom.value) mobilePane.value = 'chat'
})

onBeforeUnmount(() => {
  stopChat()
})

function openShare(roomId: string): void {
  const room = chat.rooms.find((item) => item.id === roomId) ?? null
  if (!room) return
  shareRoom.value = room
  shareOpen.value = true
}

function onCreated(room: Room): void {
  createOpen.value = false
  mobilePane.value = 'chat'
  shareRoom.value = room
  shareOpen.value = true
}

function onImported(): void {
  importOpen.value = false
  mobilePane.value = 'chat'
}

function requestDelete(roomId: string): void {
  const room = chat.rooms.find((item) => item.id === roomId) ?? null
  if (room) deleteTarget.value = room
}

function confirmDelete(): void {
  if (deleteTarget.value) deleteRoom(deleteTarget.value.id)
  deleteTarget.value = null
}

function openClearConfirm(): void {
  settingsOpen.value = false
  confirmClear.value = true
}

function openResetConfirm(): void {
  settingsOpen.value = false
  confirmReset.value = true
}

function doClear(): void {
  clearRooms()
  confirmClear.value = false
  mobilePane.value = 'list'
}

function doReset(): void {
  resetIdentity()
  confirmReset.value = false
  mobilePane.value = 'list'
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ 'is-hidden-mobile': mobilePane === 'chat' }">
      <RoomList
        @create="createOpen = true"
        @import-invite="importOpen = true"
        @share="openShare"
        @remove="requestDelete"
        @settings="settingsOpen = true"
        @select="mobilePane = 'chat'"
      />
    </aside>

    <main class="chat-pane" :class="{ 'is-hidden-mobile': mobilePane === 'list' }">
      <ChatPanel
        v-if="activeRoom"
        :room="activeRoom"
        @back="mobilePane = 'list'"
        @share="openShare(activeRoom.id)"
      />
      <section v-else class="empty-chat">
        <div class="empty-icon">
          <Icon name="lock" :size="30" />
        </div>
        <h2>选择一个房间</h2>
        <p>创建房间并分享邀请码，或导入对方的邀请码开始加密聊天。</p>
        <div class="empty-actions">
          <button class="btn btn--primary" type="button" @click="createOpen = true">
            <Icon name="plus" :size="16" />
            创建房间
          </button>
          <button class="btn btn--ghost" type="button" @click="importOpen = true">
            <Icon name="download" :size="16" />
            导入邀请
          </button>
        </div>
      </section>
    </main>

    <CreateRoomDialog :open="createOpen" @close="createOpen = false" @created="onCreated" />
    <ImportRoomDialog :open="importOpen" @close="importOpen = false" @imported="onImported" />
    <ShareRoomDialog :open="shareOpen" :room="shareRoom" @close="shareOpen = false" />
    <SettingsDialog
      :open="settingsOpen"
      @close="settingsOpen = false"
      @clear="openClearConfirm"
      @reset="openResetConfirm"
    />
    <ConfirmDialog
      :open="Boolean(deleteTarget)"
      title="删除房间"
      :message="`确定删除“${deleteTarget?.name ?? ''}”吗？本地的聊天记录也会一起删除。`"
      confirm-text="删除"
      danger
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
    <ConfirmDialog
      :open="confirmClear"
      title="清空聊天数据"
      message="所有房间、密钥和聊天记录都会从本浏览器删除，且无法恢复。会话身份会保留。"
      confirm-text="清空"
      danger
      @close="confirmClear = false"
      @confirm="doClear"
    />
    <ConfirmDialog
      :open="confirmReset"
      title="重置会话身份"
      message="将生成新的会话码，并删除本浏览器上的所有房间和数据。已经分享出去的邀请码会失效。"
      confirm-text="重置"
      danger
      @close="confirmReset = false"
      @confirm="doReset"
    />
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  height: 100dvh;
  max-width: 1440px;
  margin: 0 auto;
  overflow: hidden;
  background: var(--surface);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.08);
}

.sidebar {
  display: flex;
  min-height: 0;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.chat-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--surface);
}

.empty-chat {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 6px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-muted);
  color: var(--accent);
}

.empty-chat h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.02em;
}

.empty-chat p {
  max-width: 320px;
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.empty-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

@media (min-width: 1441px) {
  .shell {
    height: calc(100dvh - 24px);
    margin-top: 12px;
    border-radius: 20px;
  }
}

@media (max-width: 840px) {
  .shell {
    grid-template-columns: 1fr;
    box-shadow: none;
  }

  .is-hidden-mobile {
    display: none;
  }
}
</style>
