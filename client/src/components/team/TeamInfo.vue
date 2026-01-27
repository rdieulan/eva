<script setup lang="ts">
import { ref } from 'vue';
import SvgIcon from '@/components/common/SvgIcon.vue';

interface TeamData {
  id: string;
  name: string;
  location?: string;
  leader: { id: string; name: string };
}

const props = defineProps<{
  team: TeamData;
  locations: string[];
  canManageTeam: boolean;
  isLeader: boolean;
}>();

const emit = defineEmits<{
  save: [data: { name: string; location: string | null }];
  deleteTeam: [];
  leaveTeam: [];
}>();

// Edit mode state
const isEditing = ref(false);
const editName = ref('');
const editLocation = ref<string | null>(null);

// Start editing
function startEdit() {
  editName.value = props.team.name;
  editLocation.value = props.team.location ?? null;
  isEditing.value = true;
}

// Cancel editing
function cancelEdit() {
  isEditing.value = false;
}

// Save changes
function saveChanges() {
  emit('save', {
    name: editName.value,
    location: editLocation.value,
  });
  isEditing.value = false;
}
</script>

<template>
  <section class="team-info">
    <div class="section-header">
      <h2>Informations</h2>
      <button v-if="canManageTeam && !isEditing" class="btn-edit" @click="startEdit">
        <SvgIcon name="edit" />
        Modifier
      </button>
    </div>

    <div v-if="isEditing" class="edit-form">
      <div class="form-group">
        <label>Nom de l'équipe</label>
        <input v-model="editName" type="text" placeholder="Nom de l'équipe" />
      </div>
      <div class="form-group">
        <label>Localisation</label>
        <select v-model="editLocation">
          <option :value="null">Non spécifiée</option>
          <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" @click="cancelEdit">Annuler</button>
        <button class="btn-save" @click="saveChanges">Enregistrer</button>
      </div>
    </div>

    <div v-else class="info-display">
      <div class="info-item">
        <label>Nom</label>
        <span>{{ team.name }}</span>
      </div>
      <div class="info-item">
        <label>Localisation</label>
        <span>{{ team.location || 'Non spécifiée' }}</span>
      </div>
      <div class="info-item">
        <label>Leader</label>
        <span>{{ team.leader.name }}</span>
      </div>

      <!-- Delete team button (Leader only) -->
      <button
        v-if="isLeader"
        class="btn-delete-team"
        @click="$emit('deleteTeam')"
      >
        <SvgIcon name="trash" />
        Supprimer l'équipe
      </button>

      <!-- Leave team button (Non-leader members only) -->
      <button
        v-if="!isLeader"
        class="btn-leave-team"
        @click="$emit('leaveTeam')"
      >
        <SvgIcon name="close" />
        Quitter l'équipe
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.team-info {
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-lg;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  h2 {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-white;
  }
}

.btn-edit {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: $color-edit;
  color: $color-bg-primary;
  border: none;
  border-radius: $radius-md;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    filter: brightness(1.1);
  }
}

.edit-form {
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

  input, select {
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
  }
}

.form-actions {
  display: flex;
  gap: $spacing-sm;
  justify-content: flex-end;
}

.btn-cancel {
  padding: $spacing-sm $spacing-md;
  background: transparent;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-secondary;
  cursor: pointer;

  &:hover {
    background: $color-bg-secondary;
  }
}

.btn-save {
  padding: $spacing-sm $spacing-md;
  background: $color-success;
  border: none;
  border-radius: $radius-md;
  color: $color-white;
  cursor: pointer;

  &:hover {
    filter: brightness(1.1);
  }
}

.info-display {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  span {
    font-size: $font-size-base;
    color: $color-white;
  }
}

.btn-delete-team,
.btn-leave-team {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: transparent;
  border: 1px solid $color-danger;
  border-radius: $radius-md;
  color: $color-danger;
  cursor: pointer;
  margin-top: $spacing-md;
  width: fit-content;

  &:hover {
    background: rgba($color-danger, 0.1);
  }
}
</style>
