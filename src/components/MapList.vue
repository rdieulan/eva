<script setup lang="ts">
import type { MapConfig } from '../types';

defineProps<{
  maps: MapConfig[];
  selectedMapId: string | null;
}>();

const emit = defineEmits<{
  select: [mapId: string];
}>();
</script>

<template>
  <aside class="map-list">
    <h2>Maps</h2>
    <ul>
      <li
        v-for="map in maps"
        :key="map.id"
        :class="{ active: selectedMapId === map.id }"
        @click="emit('select', map.id)"
      >
        {{ map.nom }}
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.map-list {
  background: #1a1a2e;
  padding: 1rem;
  min-width: 180px;
  border-right: 1px solid #333;
}

.map-list h2 {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.map-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.map-list li {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  transition: all 0.2s;
  color: #ccc;
}

.map-list li:hover {
  background: #2a2a4a;
  color: #fff;
}

.map-list li.active {
  background: #4a4a8a;
  color: #fff;
  font-weight: 600;
}
</style>

