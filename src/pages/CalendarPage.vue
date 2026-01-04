<script setup lang="ts">
</script>

<template>
  <div class="calendar-page">
    <div class="coming-soon">
      <div class="icon">📅</div>
      <h1>Calendrier</h1>
      <p>Cette fonctionnalité sera bientôt disponible.</p>
    </div>
  </div>
</template>

<style scoped>
.calendar-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.coming-soon {
  text-align: center;
  color: #888;
}

.icon {
  font-size: 5rem;
  margin-bottom: 1rem;
}

h1 {
  color: #fff;
  margin: 0 0 0.5rem;
}

p {
  color: #666;
}
</style>
