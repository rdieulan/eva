<script setup lang="ts">
import type { MapConfig } from '@/types';
import { checkMapBalance } from '@/config/config';

defineProps<{
  maps: MapConfig[];
  selectedMapId: string | null;
}>();

const emit = defineEmits<{
  select: [mapId: string];
}>();

function isMapBalanced(map: MapConfig): boolean {
  return checkMapBalance(map).isBalanced;
}
</script>

<template>
  <aside class="map-list">
    <h2>Maps</h2>
    <ul>
      <li
        v-for="map in maps"
        :key="map.id"
        :class="{
          active: selectedMapId === map.id,
          balanced: isMapBalanced(map),
          unbalanced: !isMapBalanced(map)
        }"
        @click="emit('select', map.id)"
      >
        {{ map.name }}
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
  color: #888;
}

.map-list li.balanced {
  color: #4ade80;
}

.map-list li.unbalanced {
  color: #ff6b6b;
}

.map-list li:hover {
  background: #2a2a4a;
}

.map-list li.balanced:hover {
  color: #6ee7a0;
}

.map-list li.unbalanced:hover {
  color: #ff8a8a;
}

.map-list li.active {
  background: #4a4a8a;
  font-weight: 600;
}

.map-list li.active.balanced {
  color: #4ade80;
}

.map-list li.active.unbalanced {
  color: #ff6b6b;
}
</style>

