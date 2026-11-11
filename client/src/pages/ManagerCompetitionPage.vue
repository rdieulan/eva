<script setup lang="ts">
// The Compétition tab of the manager's space: the divisions of the venue's
// local league, which tell each team the days of its division, and the
// competitions the venue offers its teams, a division's days and tournaments
import ManagerShell from '@/components/manager/layout/ManagerShell.vue';
import ManagerSection from '@/components/manager/layout/ManagerSection.vue';
import DivisionBoard from '@/components/manager/DivisionBoard.vue';
import VenueCompetitions from '@/components/manager/VenueCompetitions.vue';
</script>

<template>
  <ManagerShell v-slot="{ venue }">
    <ManagerSection title="Divisions de la ligue" subject="competition">
      <template #intro>
        Place chaque équipe de ta ligue dans sa division. C'est d'après ces divisions que les équipes recevront les
        journées de la leur. Le site de la ligue ne dit les divisions d'un mois qu'au tirage : pars du dernier mois
        tiré, déplace les équipes qui sont montées ou descendues, puis enregistre.
      </template>
      <DivisionBoard :key="venue.id" :venue-id="venue.id" />
    </ManagerSection>

    <ManagerSection title="Compétitions de la salle" subject="competition">
      <template #intro>
        Publie les journées de chaque division et les tournois de la salle : les équipes concernées les ajoutent à leur
        calendrier. C'est toi qui donnes les dates.
      </template>
      <VenueCompetitions :key="venue.id" :venue-id="venue.id" />
    </ManagerSection>
  </ManagerShell>
</template>
