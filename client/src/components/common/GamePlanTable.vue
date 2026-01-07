<script setup lang="ts">
import { computed } from 'vue';
import type { MatchGamePlan } from '@shared/types';

export interface Header {
  id: string;
  name: string;
}

const props = defineProps<{ headers: Header[]; gamePlan: MatchGamePlan }>();

// Build rows from gamePlan internally to avoid parent-side mapping
const rows = computed(() => {
  if (!props.gamePlan || !props.gamePlan.maps || props.gamePlan.maps.length === 0) return [] as Array<{
    key: string;
    label: string;
    cells: Record<string, { name: string; color: string } | null>;
  }>;

  return props.gamePlan.maps.map(mapPlan => {
    const cells: Record<string, { name: string; color: string } | null> = {};
    for (const h of props.headers) {
      const assign = mapPlan.assignments.find(a => a.visibleplayerId === h.id);
      cells[h.id] = assign ? { name: assign.assignmentName, color: assign.assignmentColor } : null;
    }
    return { key: mapPlan.mapId, label: mapPlan.mapName, cells };
  });
});

const hasData = computed(() => props.headers.length > 0 && rows.value.length > 0);
</script>

<template>
  <div class="game-plan-table">
    <table v-if="hasData">
      <thead>
        <tr>
          <th>Map</th>
          <th v-for="h in props.headers" :key="h.id">{{ h.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td class="map-name">{{ row.label }}</td>
          <td v-for="h in props.headers" :key="h.id" class="assignment-cell">
            <span
              v-if="row.cells[h.id]"
              class="assignment-badge"
              :style="{ color: row.cells[h.id]!.color, borderColor: row.cells[h.id]!.color }"
            >
              {{ row.cells[h.id]!.name }}
            </span>
            <span v-else class="assignment-badge" style="opacity:0.6">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.game-plan-table {
  overflow-x: auto;
}

.game-plan-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.game-plan-table th,
.game-plan-table td {
  padding: 0.5rem;
  text-align: center;
  border-bottom: 1px solid #3a3a5a;
}

.game-plan-table th {
  color: #888;
  font-weight: 600;
}

.game-plan-table .map-name {
  text-align: left;
  color: #fff;
  font-weight: 500;
}

.assignment-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border: 1px solid;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
