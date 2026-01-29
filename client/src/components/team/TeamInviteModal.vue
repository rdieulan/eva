<script setup lang="ts">
import { ref } from 'vue';
import type { TeamInvite } from '@/api';
import Modal from '@/components/common/Modal.vue';

defineProps<{
  open: boolean;
  isCreating: boolean;
  generatedInvite: TeamInvite | null;
}>();

const emit = defineEmits<{
  close: [];
  generate: [options: { expiresInHours: number; maxUses: number }];
  copy: [url: string];
}>();

// Form state
const expiresHours = ref(24);
const maxUses = ref(1);

// Expiration options
const expirationOptions = [
  { value: 1, label: '1 heure' },
  { value: 6, label: '6 heures' },
  { value: 12, label: '12 heures' },
  { value: 24, label: '24 heures' },
  { value: 48, label: '48 heures' },
  { value: 168, label: '7 jours' },
];

// Generate invite
function handleGenerate() {
  emit('generate', {
    expiresInHours: expiresHours.value,
    maxUses: maxUses.value,
  });
}

// Reset form when modal opens
function resetForm() {
  expiresHours.value = 24;
  maxUses.value = 1;
}

// Expose reset for parent
defineExpose({ resetForm });
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <template #header>
      <h3>Inviter un membre</h3>
    </template>

    <div class="invite-form">
      <!-- Generated invite display -->
      <div v-if="generatedInvite" class="generated-invite">
        <p class="success-text">✅ Lien généré avec succès !</p>
        <div class="invite-url-box">
          <input
            type="text"
            :value="generatedInvite.url"
            readonly
            class="invite-url"
          />
          <button class="btn-copy" @click="$emit('copy', generatedInvite.url)">
            📋 Copier
          </button>
        </div>
        <p class="invite-info">
          Ce lien expire dans {{ expiresHours }} heures et peut être utilisé {{ maxUses }} fois.
        </p>
      </div>

      <!-- Form -->
      <template v-else>
        <div class="form-group">
          <label>Durée de validité</label>
          <select v-model="expiresHours" :disabled="isCreating">
            <option v-for="opt in expirationOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Nombre d'utilisations maximum</label>
          <input
            v-model.number="maxUses"
            type="number"
            min="1"
            max="100"
            :disabled="isCreating"
          />
        </div>
      </template>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="$emit('close')">
        {{ generatedInvite ? 'Fermer' : 'Annuler' }}
      </button>
      <button
        v-if="!generatedInvite"
        class="btn-generate"
        :disabled="isCreating"
        @click="handleGenerate"
      >
        {{ isCreating ? 'Génération...' : 'Générer le lien' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.invite-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  select, input {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-secondary;
    border: 1px solid $color-border-light;
    border-radius: $radius-md;
    color: $color-white;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }

    &:disabled {
      opacity: 0.5;
    }
  }
}

.generated-invite {
  text-align: center;
}

.success-text {
  font-size: $font-size-lg;
  color: $color-success;
  margin-bottom: $spacing-md;
}

.invite-url-box {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.invite-url {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  color: $color-accent;
  font-family: monospace;
  font-size: $font-size-sm;
}

.btn-copy {
  @include btn-base($color-accent);
  white-space: nowrap;
}

.invite-info {
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.btn-cancel {
  @include btn-base($color-danger);
}

.btn-generate {
  @include btn-base($color-success);
}
</style>
