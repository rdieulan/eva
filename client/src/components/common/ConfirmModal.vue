<script setup lang="ts">
import { ref, computed } from 'vue';
import Modal from '@/components/common/Modal.vue';

const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requireInput?: string; // If set, user must type this to confirm
  danger?: boolean; // Style confirm button as danger
  cancelDanger?: boolean; // Style cancel button as danger
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const inputValue = ref('');

const canConfirm = computed(() => {
  if (!props.requireInput) return true;
  return inputValue.value.toLowerCase() === props.requireInput.toLowerCase();
});

function handleConfirm() {
  if (canConfirm.value) {
    inputValue.value = '';
    emit('confirm');
  }
}

function handleCancel() {
  inputValue.value = '';
  emit('cancel');
}
</script>

<template>
  <Modal :open="open" @close="handleCancel">
    <template #header>
      <h3 :class="{ danger: danger }">{{ title }}</h3>
    </template>

    <div class="confirm-content">
      <p>{{ message }}</p>

      <div v-if="requireInput" class="input-confirm">
        <label>
          Tapez <strong>{{ requireInput }}</strong> pour confirmer :
        </label>
        <input
          v-model="inputValue"
          type="text"
          :placeholder="requireInput"
          @keyup.enter="handleConfirm"
        />
      </div>
    </div>

    <template #footer>
      <div class="footer-actions">
        <slot name="extra-actions"></slot>
        <button
          class="btn-cancel"
          :class="{ danger: cancelDanger }"
          @click="handleCancel"
        >
          {{ cancelText || 'Annuler' }}
        </button>
        <button
          class="btn-confirm"
          :class="{ danger: danger }"
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          {{ confirmText || 'Confirmer' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;
@use 'sass:color';

h3 {
  margin: 0;
  color: $color-text-primary;

  &.danger {
    color: $color-danger;
  }
}

.confirm-content {
  padding: $spacing-md 0;

  p {
    margin: 0 0 $spacing-md;
    color: $color-text-secondary;
    line-height: 1.5;
  }
}

.input-confirm {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;

    strong {
      color: $color-danger;
    }
  }

  input {
    padding: $spacing-sm;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-primary;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  width: 100%;
}

.btn-cancel,
.btn-confirm {
  @include btn-base($color-accent);
}

.btn-cancel {
  @include btn-base($color-danger);
}

.btn-confirm {
  @include btn-base($color-success);

  &.danger {
    @include btn-base($color-danger);
  }
}
</style>
