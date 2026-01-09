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
    cells: Record<string, { name: string; color: string; isMainRole?: boolean } | null>;
  }>;

  return props.gamePlan.maps.map(mapPlan => {
    const cells: Record<string, { name: string; color: string; isMainRole?: boolean } | null> = {};
    for (const h of props.headers) {
      const assign = mapPlan.assignments.find(a => a.visibleplayerId === h.id);
      cells[h.id] = assign ? { name: assign.assignmentName, color: assign.assignmentColor, isMainRole: assign.isMainRole } : null;
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
              <span v-if="row.cells[h.id]!.isMainRole" class="main-star">★</span>
              {{ row.cells[h.id]!.name }}
            </span>
            <span v-else class="assignment-badge" style="opacity:0.6">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.game-plan-table {
  overflow-x: auto;

  @include mobile-lg {
    margin: 0 (0 - $spacing-sm);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;

    @include tablet {
      font-size: 0.8rem;
    }

    @include mobile-lg {
      font-size: 0.75rem;
      min-width: 400px;
    }

    @include mobile {
      font-size: 0.7rem;
    }
  }

  th,
  td {
    padding: $spacing-sm;
    text-align: center;
    border-bottom: 1px solid $color-border-light;

    @include tablet {
      padding: 0.4rem;
    }

    @include mobile-lg {
      padding: 0.35rem $spacing-xs;
    }

    @include mobile {
      padding: $spacing-xs 0.2rem;
    }
  }

  th {
    color: $color-text-secondary;
    font-weight: 600;
  }

  .map-name {
    text-align: left;
    color: #fff;
    font-weight: 500;
  }
}

.assignment-badge {
  display: inline-block;
  padding: 0.2rem $spacing-sm;
  border: 1px solid;
  border-radius: $radius-sm;
  font-size: 0.75rem;
  font-weight: 600;

  .main-star {
    color: $color-star;
    margin-right: 0.15rem;
  }

  @include tablet {
    padding: 0.15rem 0.4rem;
    font-size: 0.7rem;
  }

  @include mobile-lg {
    padding: 0.1rem 0.3rem;
    font-size: 0.65rem;
  }

  @include mobile {
    padding: 0.1rem $spacing-xs;
    font-size: 0.6rem;
  }
}
</style>
