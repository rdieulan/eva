<script setup lang="ts">
import Modal from '@/components/common/Modal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

defineProps<{
  open: boolean;
  errors: string[];
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Modal :open="open" :title="title || 'Erreur'" size="sm" @close="emit('close')">
    <ErrorDisplay :errors="errors" />
    <template #footer>
      <button class="btn-secondary" @click="emit('close')">
        Fermer
      </button>
    </template>
  </Modal>
</template>
