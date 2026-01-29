<script setup lang="ts">
import type { TeamMember } from '@/api';
import SvgIcon from '@/components/common/SvgIcon.vue';

defineProps<{
  members: TeamMember[];
  currentUserId?: string;
  canManagePermissions: boolean;
  canRemoveMembers: boolean;
  canInviteMembers: boolean;
}>();

defineEmits<{
  invite: [];
  editPermissions: [member: TeamMember];
  removeMember: [member: TeamMember];
}>();
</script>

<template>
  <section class="team-members">
    <div class="section-header">
      <h2>Membres ({{ members.length }})</h2>
      <button v-if="canInviteMembers" class="btn-invite" @click="$emit('invite')">
        ➕ Inviter
      </button>
    </div>

    <div class="members-list">
      <div
        v-for="member in members"
        :key="member.id"
        class="member-card"
        :class="{ 'is-leader': member.isLeader, 'is-me': member.id === currentUserId }"
      >
        <div class="member-info">
          <span class="member-name">
            {{ member.name }}
            <span v-if="member.isLeader" class="badge leader">Leader</span>
            <span v-if="member.id === currentUserId" class="badge me">Vous</span>
          </span>
          <span class="member-email">{{ member.email }}</span>
        </div>

        <div class="member-actions" v-if="canManagePermissions && !member.isLeader && member.id !== currentUserId">
          <button class="btn-icon" title="Gérer les permissions" @click="$emit('editPermissions', member)">
            <SvgIcon name="settings" />
          </button>
          <button
            v-if="canRemoveMembers"
            class="btn-icon danger"
            title="Retirer de l'équipe"
            @click="$emit('removeMember', member)"
          >
            <SvgIcon name="trash" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.team-members {
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
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

.btn-invite {
  @include btn-base($color-success);
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.member-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  background: $color-bg-secondary;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;

  &.is-leader {
    border-color: $color-accent;
  }

  &.is-me {
    background: rgba($color-accent, 0.1);
  }
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.member-name {
  font-size: $font-size-base;
  color: $color-white;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.member-email {
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.badge {
  padding: 2px $spacing-sm;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: 600;

  &.leader {
    background: $color-accent;
    color: $color-bg-primary;
  }

  &.me {
    background: $color-info;
    color: $color-white;
  }
}

.member-actions {
  display: flex;
  gap: $spacing-sm;
}

.btn-icon {
  @include btn-icon($color-edit);

  &.danger {
    @include btn-icon($color-danger);
  }
}
</style>
