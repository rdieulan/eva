<script setup lang="ts">
import SegmentedControl, { type SegmentedOption } from '@/components/common/SegmentedControl.vue';
import type { ViewMode } from '@/composables/useCalendarNavigation';

// How a calendar lays its days out: the month, or a week
const viewMode = defineModel<ViewMode>({ required: true });

const VIEW_OPTIONS: SegmentedOption<ViewMode>[] = [
  { value: 'month', label: 'Mois' },
  { value: 'week', label: 'Semaine' },
];
</script>

<template>
  <SegmentedControl label="Affichage" :options="VIEW_OPTIONS" v-model="viewMode" />
</template>
