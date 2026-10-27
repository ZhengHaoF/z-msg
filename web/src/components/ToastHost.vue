<script setup lang="ts">
import Icon from './Icon.vue'
import { dismissToast, toasts } from '../lib/toast'

function iconFor(kind: string): 'alert' | 'check' | 'info' {
  if (kind === 'error') return 'alert'
  if (kind === 'success') return 'check'
  return 'info'
}
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast"
        :class="`toast--${item.kind}`"
        role="status"
      >
        <Icon :name="iconFor(item.kind)" :size="16" />
        <span class="toast-text">{{ item.text }}</span>
        <button class="toast-close" type="button" aria-label="关闭提示" @click="dismissToast(item.id)">
          <Icon name="close" :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: max(18px, env(safe-area-inset-top));
  left: 50%;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(420px, calc(100vw - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 13px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.28);
  pointer-events: auto;
}

.toast--success {
  background: #14532d;
}

.toast--error {
  background: #7f1d1d;
}

.toast-text {
  flex: 1;
  line-height: 1.45;
}

.toast-close {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: rgba(248, 250, 252, 0.75);
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.toast-move {
  transition: transform 0.2s ease;
}
</style>
