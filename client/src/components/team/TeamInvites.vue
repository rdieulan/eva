<script setup lang="ts">
import type { TeamInvite } from '@/api';
import SvgIcon from '@/components/common/SvgIcon.vue';

// The links of the team, each told apart by who made it, when it runs out and
// how many joined through it: its code says nothing to a reader, and the
// button copies the link itself
defineProps<{
  invites: TeamInvite[];
}>();

defineEmits<{
  copy: [url: string];
  revoke: [inviteId: string];
}>();

// When the link runs out, as a phrase: "Expire dans 23h 59min", or "Expiré"
function describeExpiry(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'Expiré';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) return `Expire dans ${Math.floor(hours / 24)}j ${hours % 24}h`;
  if (hours > 0) return `Expire dans ${hours}h ${minutes}min`;
  return `Expire dans ${minutes}min`;
}

// How many joined through the link, out of how many it lets in
function describeUses(invite: TeamInvite): string {
  return `${invite.uses}/${invite.maxUses} utilisation${invite.maxUses > 1 ? 's' : ''}`;
}
</script>

<template>
  <div v-if="invites.length > 0" class="invites-section">
    <h3>Invitations actives ({{ invites.length }})</h3>
    <div class="invites-list">
      <div v-for="invite in invites" :key="invite.id" class="invite-item">
        <div class="invite-info">
          <span class="invite-creator">Créé par {{ invite.createdBy }}</span>
          <span class="invite-details"><span class="invite-detail">{{ describeExpiry(invite.expiresAt) }}</span> • <span class="invite-detail">{{ describeUses(invite) }}</span></span>
        </div>
        <div class="invite-actions">
          <button class="btn-copy" @click="$emit('copy', invite.url)" title="Copier le lien">
            <SvgIcon name="copy" />
          </button>
          <button class="btn-revoke" @click="$emit('revoke', invite.id)" title="Révoquer">
            <SvgIcon name="trash" />
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
  border-top: $border-thin solid $color-border-light;

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

// The text gives way on a narrow screen, the buttons never do
.invite-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
}

.invite-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  min-width: 0;
}

.invite-creator {
  font-size: $font-size-sm;
  font-weight: 600;
  color: $color-white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-details {
  font-size: $font-size-xs;
  color: $color-text-secondary;
}

// A narrow row wraps between the two, never inside one
.invite-detail {
  white-space: nowrap;
}

.invite-actions {
  display: flex;
  flex-shrink: 0;
  gap: $spacing-sm;
}

.btn-copy {
  @include btn-icon($color-accent);
}

.btn-revoke {
  @include btn-icon($color-danger);
}
</style>
