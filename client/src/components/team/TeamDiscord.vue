<script setup lang="ts">
// Where the team's notifications go besides the bell: a channel of its Discord
// server. Whoever manages the team links it, changes it or removes it; the
// others see whether it is there.
import { computed } from 'vue';
import DiscordChannel from '@/components/common/DiscordChannel.vue';
import { linkTeamDiscord, unlinkTeamDiscord } from '@/api';
import type { DiscordChannelStatus } from '@shared/types';

const props = defineProps<{
  status: DiscordChannelStatus;
  canManage: boolean;
}>();

const emit = defineEmits<{
  changed: [status: DiscordChannelStatus];
}>();

const says = computed(() => ({
  linked: `Les notifications de l'équipe sont postées dans ${props.canManage ? 'votre salon Discord' : 'le salon Discord de l\'équipe'}.`,
  broken: `Discord a refusé le dernier message : le webhook a sans doute été supprimé.${props.canManage ? ' Collez une nouvelle adresse pour reprendre.' : ''}`,
  none: props.canManage
    ? 'Les notifications de l\'équipe peuvent aussi arriver dans un salon de votre serveur Discord.'
    : 'Aucun salon Discord n\'est relié.',
}));
</script>

<template>
  <section class="team-discord">
    <h2>Discord</h2>
    <DiscordChannel
      :status="status"
      :can-manage="canManage"
      :says="says"
      :link="linkTeamDiscord"
      :unlink="unlinkTeamDiscord"
      @changed="emit('changed', $event)"
    />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.team-discord {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;

  h2 {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-white;
  }
}
</style>
