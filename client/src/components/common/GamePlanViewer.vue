<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MatchGamePlan } from '@shared/types';

const props = defineProps<{
  gamePlan: MatchGamePlan;
}>();

const exportContentRef = ref<HTMLDivElement | null>(null);

// Build headers from gamePlan (sorted alphabetically)
const headers = computed(() => {
  const assignments = props.gamePlan?.maps?.[0]?.assignments;
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }

  return assignments
    .map(a => ({
      id: a.visiblePlayerId || '',
      name: a.visiblePlayerName || '',
    }))
    .filter(h => h.id && h.name)
    .sort((a, b) => a.name.localeCompare(b.name));
});

// Build rows from gamePlan
const rows = computed(() => {
  if (!props.gamePlan?.maps?.length) return [];

  return props.gamePlan.maps.map(mapPlan => {
    const cells: Record<string, { name: string; color: string; isMainRole?: boolean } | null> = {};
    for (const h of headers.value) {
      const assign = mapPlan.assignments.find(a => a.visiblePlayerId === h.id);
      cells[h.id] = assign
        ? { name: assign.assignmentName, color: assign.assignmentColor, isMainRole: assign.isMainRole }
        : null;
    }
    return { key: mapPlan.mapId, label: mapPlan.mapName, planName: mapPlan.planName, cells };
  });
});

const hasData = computed(() => headers.value.length > 0 && rows.value.length > 0);

// Export to PNG
async function exportToPng() {
  if (!exportContentRef.value) return;

  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(exportContentRef.value, {
      backgroundColor: '-bg-secondary',
      scale: 2,
    });

    const link = document.createElement('a');
    link.download = `plan-de-jeu-${props.gamePlan.absentPlayerName || 'export'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('PNG export error:', err);
    alert("Erreur lors de l'export PNG");
  }
}
</script>

<template>
  <div class="game-plan-viewer">
    <!-- Exportable content -->
    <div ref="exportContentRef" class="export-content">
      <div class="viewer-header">
        <span class="viewer-title">PLAN DE JEU</span>
        <span v-if="gamePlan.absentPlayerName" class="absent-badge">
          {{ gamePlan.absentPlayerName }} absent(e)
        </span>
      </div>

      <div class="table-container">
        <table v-if="hasData">
          <thead>
            <tr>
              <th>Map</th>
              <th v-for="h in headers" :key="h.id">{{ h.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td class="map-name">
                {{ row.label }}
                <span v-if="row.planName" class="plan-name">{{ row.planName }}</span>
              </td>
              <td v-for="h in headers" :key="h.id" class="assignment-cell">
                <span
                  v-if="row.cells[h.id]"
                  class="assignment-badge"
                  :style="{ color: row.cells[h.id]!.color, borderColor: row.cells[h.id]!.color }"
                >
                  <span v-if="row.cells[h.id]!.isMainRole" class="main-star">★</span>
                  {{ row.cells[h.id]!.name }}
                </span>
                <span v-else class="assignment-badge empty">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Export button -->
    <button type="button" class="btn-export-png" @click="exportToPng">
      🖼️ Télécharger (PNG)
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.game-plan-viewer {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.export-content {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-md;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  @include mobile-lg {
    flex-direction: column;
    gap: $spacing-sm;
  }
}

.viewer-title {
  font-size: 1rem;
  font-weight: 700;
  color: $color-white;
  letter-spacing: 0.05em;
}

.absent-badge {
  background: rgba($color-danger, 0.2);
  color: $color-danger;
  padding: $spacing-xs 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.table-container {
  overflow-x: auto;

  @include mobile-lg {
    margin: 0 (0 - $spacing-sm);
  }
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
  color: $color-white;
  font-weight: 500;

  .plan-name {
    display: block;
    font-size: 0.7rem;
    font-weight: 400;
    color: $color-text-secondary;
    margin-top: 0.1rem;
  }
}

.assignment-badge {
  display: inline-block;
  padding: 0.2rem $spacing-sm;
  border: 1px solid;
  border-radius: $radius-sm;
  font-size: 0.75rem;
  font-weight: 600;

  &.empty {
    opacity: 0.6;
  }

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

.btn-export-png {
  align-self: center;
  padding: 0.75rem 1.5rem;
  background: rgba($color-success, 0.2);
  border: 1px solid $color-success;
  border-radius: $radius-md;
  color: $color-success;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba($color-success, 0.3);
  }

  @include mobile-lg {
    align-self: stretch;
    text-align: center;
  }
}
</style>
