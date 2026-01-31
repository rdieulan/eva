<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Venue } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';

interface TeamData {
  id: string;
  name: string;
  venueId?: string;
  leader: { id: string; name: string };
}

const props = defineProps<{
  team: TeamData;
  venues: Venue[];
  canManageTeam: boolean;
  isLeader: boolean;
}>();

const emit = defineEmits<{
  save: [data: { name: string; venueId: string | null }];
  deleteTeam: [];
  leaveTeam: [];
}>();

// Computed venue name
const venueName = computed(() => {
  if (!props.team.venueId) return 'Non affiliée';
  const venue = props.venues.find(v => v.id === props.team.venueId);
  return venue ? `${venue.name} - ${venue.city}` : 'Inconnue';
});

// Edit mode state
const isEditing = ref(false);
const editName = ref('');
const editVenueId = ref<string | null>(null);

// Start editing
function startEdit() {
  editName.value = props.team.name;
  editVenueId.value = props.team.venueId ?? null;
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
    venueId: editVenueId.value,
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
        <label>Salle affiliée</label>
        <select v-model="editVenueId">
          <option :value="null">Non affiliée</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">
            {{ venue.name }} - {{ venue.city }}
          </option>
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
        <label>Salle affiliée</label>
        <span>{{ venueName }}</span>
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
@use '@/styles/buttons' as *;

.team-info {
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  height: fit-content;
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
  @include btn-base($color-edit);
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
  @include btn-base($color-danger);
}

.btn-save {
  @include btn-base($color-success);
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
  @include btn-base($color-danger);
  margin-top: $spacing-lg;
  width: fit-content;
}
</style>
