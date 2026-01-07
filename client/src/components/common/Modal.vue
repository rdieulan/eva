<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    closeOnBackdrop?: boolean;
  }>(),
  {
    size: 'md',
    closeOnBackdrop: true,
  }
);

const emit = defineEmits<{
  close: [];
}>();

// Close on Escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('close');
  }
}

// Handle backdrop click
function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    emit('close');
  }
}

// Prevent body scroll when modal is open
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
);

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="handleBackdropClick">
        <div class="modal-container" :class="[`modal-${size}`]">
          <!-- Header -->
          <div v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <h2 class="modal-title">{{ title }}</h2>
            </slot>
            <button class="btn-close" @click="emit('close')" title="Fermer">
              <svg viewBox="0 0 24 24" class="close-icon">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <slot></slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 12px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-sm {
  width: 100%;
  max-width: 400px;
}

.modal-md {
  width: 100%;
  max-width: 560px;
}

.modal-lg {
  width: 100%;
  max-width: 800px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #333;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #2a2a4a;
}

.close-icon {
  width: 20px;
  height: 20px;
  fill: #888;
}

.btn-close:hover .close-icon {
  fill: #fff;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #333;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container {
  transform: scale(0.95) translateY(-20px);
}

.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>

