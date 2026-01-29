<script setup lang="ts">
import type { TeamInvite } from '@/api';

defineProps<{
  invites: TeamInvite[];
}>();

defineEmits<{
  copy: [url: string];
  revoke: [inviteId: string];
}>();

// Format expiration date
function formatExpiration(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Expiré';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
  }

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
}
</script>

<template>
  <div v-if="invites.length > 0" class="invites-section">
    <h3>Invitations actives ({{ invites.length }})</h3>
    <div class="invites-list">
      <div v-for="invite in invites" :key="invite.id" class="invite-item">
        <div class="invite-info">
          <code class="invite-code">{{ invite.code }}</code>
          <span class="invite-details">
            Expire dans {{ formatExpiration(invite.expiresAt) }} •
            {{ invite.uses }}/{{ invite.maxUses }} utilisation(s)
          </span>
        </div>
        <div class="invite-actions">
          <button class="btn-copy" @click="$emit('copy', invite.url)" title="Copier le lien">
            📋
          </button>
          <button class="btn-revoke" @click="$emit('revoke', invite.id)" title="Révoquer">
            ❌
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.invites-section {
  margin-top: $spacing-lg;
  padding-top: $spacing-lg;
  border-top: 1px solid $color-border-light;

  h3 {
    margin: 0 0 $spacing-md;
    font-size: $font-size-lg;
    color: $color-white;
  }
}

.invites-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.invite-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
}

.invite-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.invite-code {
  font-family: monospace;
  font-size: $font-size-sm;
  color: $color-accent;
  background: $color-bg-tertiary;
  padding: 2px $spacing-sm;
  border-radius: $radius-sm;
}

.invite-details {
  font-size: $font-size-xs;
  color: $color-text-secondary;
}

.invite-actions {
  display: flex;
  gap: $spacing-sm;
}

.btn-copy {
  @include btn-icon($color-info);
}

.btn-revoke {
  @include btn-icon($color-danger);
}
</style>
