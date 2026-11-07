<script setup lang="ts">
// The teams waiting for our answer on a search of ours, in a small green
// round: on its row in the list of a day (see DayItems), and beside its mark
// in the day (see OwnSearchMark)
defineProps<{
  count: number;
}>();
</script>

<template>
  <span class="pending-count" :title="count > 1 ? `${count} équipes ont proposé un match` : 'Une équipe a proposé un match'">{{ count }}</span>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.pending-count {
  flex-shrink: 0;
  min-width: 1.6em;
  padding: 0 0.35em;
  border-radius: 999px;
  background: $color-success;
  color: $color-bg-primary;
  font-size: 0.85em; // Of the text around it: never taller than its row
  line-height: 1.3;
  font-weight: 700;
  text-align: center;
}
</style>
