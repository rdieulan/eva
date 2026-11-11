<script setup lang="ts">
// The Calendrier tab of the manager's space: the venue's calendar, what it
// publishes and the matches played there
import ManagerShell from '@/components/manager/layout/ManagerShell.vue';
import VenueCalendar from '@/components/calendar/VenueCalendar.vue';
</script>

<template>
  <ManagerShell v-slot="{ venue }">
    <VenueCalendar :key="venue.id" :venue-id="venue.id" />
  </ManagerShell>
</template>
