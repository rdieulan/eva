<template>
  <div class="no-team-message">
    <div class="no-team-icon">👥</div>
    <h2>Aucune équipe</h2>
    <p>Vous n'êtes pas encore membre d'une équipe.</p>
    <p>Rejoignez une équipe existante ou créez la vôtre pour accéder à cette fonctionnalité.</p>
    <router-link to="/team" class="btn-team">
      <span>Gérer mon équipe</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
// No props needed - simple informational component
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.no-team-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-xl;
  text-align: center;
  min-height: 300px;

  .no-team-icon {
    font-size: 4rem;
  }

  h2 {
    margin: 0;
    color: $color-text-primary;
  }

  p {
    margin: 0;
    color: $color-text-secondary;
    max-width: 400px;
  }

  .btn-team {
    display: inline-flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
    background-color: $color-accent;
    color: $color-text-primary;
    border-radius: $radius-md;
    text-decoration: none;
    font-weight: 500;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba($color-accent, 0.8);
    }
  }
}
</style>
