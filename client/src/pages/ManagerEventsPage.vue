<script setup lang="ts">
// The Événements tab of the manager's space: what the venue publishes that is
// not a competition, open to all, offered to no team
import ManagerShell from '@/components/manager/layout/ManagerShell.vue';
import ManagerSection from '@/components/manager/layout/ManagerSection.vue';
import VenueEvents from '@/components/manager/VenueEvents.vue';
</script>

<template>
  <ManagerShell v-slot="{ venue }">
    <ManagerSection title="Événements de la salle" subject="event">
      <template #intro>
        Publie ce qui est ouvert à tous, équipes de ligue ou non et joueurs seuls : une nocturne, une soirée. Aucune
        équipe ne le reçoit : les équipes de ta salle le voient dans leur calendrier et l'y ajoutent si elles veulent.
      </template>
      <VenueEvents :key="venue.id" :venue-id="venue.id" />
    </ManagerSection>
  </ManagerShell>
</template>
