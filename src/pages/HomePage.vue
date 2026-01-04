<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function goToPlanner() {
  router.push('/planner');
}

function goToCalendar() {
  router.push('/calendar');
}
</script>

<template>
  <div class="home-page">
    <div class="hero">
      <h1>EVA</h1>
      <p class="subtitle">Outil de gestion d'équipe FPS 4v4</p>
    </div>

    <nav class="nav-cards">
      <button class="nav-card" @click="goToPlanner">
        <div class="card-icon">📋</div>
        <h2>Planificateur</h2>
        <p>Organisez les postes de votre équipe par map</p>
      </button>

      <button class="nav-card" @click="goToCalendar">
        <div class="card-icon">📅</div>
        <h2>Calendrier</h2>
        <p>Planifiez vos sessions d'entraînement</p>
        <span class="badge coming-soon">À venir</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 4rem;
  font-weight: 800;
  color: #7a7aba;
  margin: 0;
  letter-spacing: 0.2em;
}

.subtitle {
  font-size: 1.2rem;
  color: #888;
  margin-top: 0.5rem;
}

.nav-cards {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}

.nav-card {
  background: #2a2a4a;
  border: 2px solid #3a3a5a;
  border-radius: 16px;
  padding: 2rem;
  width: 280px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  position: relative;
}

.nav-card:hover {
  transform: translateY(-8px);
  border-color: #7a7aba;
  box-shadow: 0 12px 40px rgba(122, 122, 186, 0.2);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.nav-card h2 {
  color: #fff;
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.nav-card p {
  color: #888;
  margin: 0;
  font-size: 0.9rem;
}

.badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

.badge.coming-soon {
  background: #ff6b6b;
  color: #fff;
}
</style>
