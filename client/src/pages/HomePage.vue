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
      </button>
    </nav>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.home-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  background: linear-gradient(135deg, $color-bg-secondary 0%, #16213e 100%);

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
    justify-content: flex-start;
    padding-top: $spacing-xl;
  }

  @include mobile {
    padding: 0.75rem;
    padding-top: $spacing-lg;
  }
}

.hero {
  text-align: center;
  margin-bottom: $spacing-2xl;

  @include mobile-lg {
    margin-bottom: $spacing-xl;
  }

  @include mobile {
    margin-bottom: $spacing-lg;
  }

  h1 {
    font-size: $font-size-4xl;
    font-weight: 800;
    color: $color-accent;
    margin: 0;
    letter-spacing: 0.2em;

    @include tablet {
      font-size: 3rem;
    }

    @include mobile-lg {
      font-size: 2.5rem;
      letter-spacing: 0.15em;
    }

    @include mobile {
      font-size: 2rem;
      letter-spacing: 0.1em;
    }
  }
}

.subtitle {
  font-size: 1.2rem;
  color: $color-text-secondary;
  margin-top: $spacing-sm;

  @include mobile-lg {
    font-size: 1rem;
  }

  @include mobile {
    font-size: 0.9rem;
  }
}

.nav-cards {
  display: flex;
  gap: $spacing-xl;
  flex-wrap: wrap;
  justify-content: center;

  @include mobile-lg {
    flex-direction: column;
    gap: $spacing-md;
    width: 100%;
    max-width: 400px;
  }

  @include mobile {
    gap: 0.75rem;
  }
}

.nav-card {
  background: $color-bg-tertiary;
  border: 2px solid $color-border-light;
  border-radius: $radius-xl;
  padding: $spacing-xl;
  width: 280px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  position: relative;

  &:hover {
    transform: translateY(-8px);
    border-color: $color-accent;
    box-shadow: 0 12px 40px rgba(122, 122, 186, 0.2);
  }

  @include tablet {
    width: 240px;
    padding: $spacing-lg;
  }

  @include mobile-lg {
    width: 100%;
    padding: 1.25rem;

    &:hover {
      transform: translateY(-4px);
    }
  }

  @include mobile {
    padding: $spacing-md;
    border-radius: $radius-lg;
  }

  h2 {
    color: #fff;
    margin: 0 0 $spacing-sm;
    font-size: 1.5rem;

    @include tablet {
      font-size: 1.25rem;
    }

    @include mobile {
      font-size: 1.1rem;
      margin-bottom: $spacing-xs;
    }
  }

  p {
    color: $color-text-secondary;
    margin: 0;
    font-size: 0.9rem;

    @include mobile {
      font-size: 0.8rem;
    }
  }
}

.card-icon {
  font-size: 3rem;
  margin-bottom: $spacing-md;

  @include tablet {
    font-size: 2.5rem;
  }

  @include mobile {
    font-size: 2rem;
    margin-bottom: $spacing-sm;
  }
}

.badge {
  position: absolute;
  top: $spacing-md;
  right: $spacing-md;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm;
  font-size: 0.7rem;
  font-weight: 600;

  &.coming-soon {
    background: $color-danger;
    color: #fff;
  }

  @include mobile {
    top: 0.75rem;
    right: 0.75rem;
    font-size: 0.65rem;
  }
}
</style>
