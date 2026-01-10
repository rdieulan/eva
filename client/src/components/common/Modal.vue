<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import SvgIcon from '@/components/common/SvgIcon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    closeOnBackdrop?: boolean;
    showCloseButton?: boolean;
  }>(),
  {
    size: 'md',
    closeOnBackdrop: true,
    showCloseButton: true,
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
            <button v-if="showCloseButton" class="btn-close" @click="emit('close')" title="Fermer">
              <SvgIcon name="close" class="close-icon" />
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

<style scoped lang="scss">
@use '@/styles/variables' as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $spacing-md;

  @include mobile-lg {
    padding: 0;
    align-items: flex-start;
  }
}

.modal-container {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);

  @include mobile-lg {
    max-height: 95vh;
    border-radius: 0 0 $radius-xl $radius-xl;
    width: 100% !important;
    max-width: 100% !important;
  }
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

  @include tablet {
    max-width: 95%;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid $color-border;

  @include tablet {
    padding: 0.875rem 1.25rem;
  }

  @include mobile-lg {
    padding: 0.75rem $spacing-md;
  }

  @include mobile {
    padding: 0.625rem 0.875rem;
  }
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;

  @include tablet {
    font-size: 1.1rem;
  }

  @include mobile-lg {
    font-size: 1rem;
  }

  @include mobile {
    font-size: 0.95rem;
  }
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

  &:hover {
    background: $color-bg-tertiary;
  }

  @include mobile-lg {
    width: 36px;
    height: 36px;
  }
}

.close-icon {
  width: 20px;
  height: 20px;
  fill: $color-text-secondary;

  .btn-close:hover & {
    fill: #fff;
  }
}

.modal-body {
  padding: $spacing-lg;
  overflow-y: auto;

  @include tablet {
    padding: 1.25rem;
  }

  @include mobile-lg {
    padding: $spacing-md;
  }

  @include mobile {
    padding: 0.875rem;
  }
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: $spacing-md $spacing-lg;
  border-top: 1px solid $color-border;

  @include tablet {
    padding: 0.875rem 1.25rem;
  }

  @include mobile-lg {
    padding: 0.75rem $spacing-md;
    gap: $spacing-sm;
  }

  @include mobile {
    padding: 0.625rem 0.875rem;
    flex-wrap: wrap;
  }
}

// Transitions
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;

  .modal-container {
    transition: transform 0.2s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container {
  transform: scale(0.95) translateY(-20px);

  @include mobile-lg {
    transform: translateY(-100%);
  }
}

.modal-leave-to .modal-container {
  transform: scale(0.95);

  @include mobile-lg {
    transform: translateY(-100%);
  }
}
</style>

