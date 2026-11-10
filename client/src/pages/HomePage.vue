<script setup lang="ts">
// Home. A player of a team finds what they have to do soon, the most pressing
// first; the tabs of the top bar, at the foot of the screen on a phone, lead to
// the team's pages. A player with no team finds how to make or join one.
import { useAuth } from '@/composables/useAuth';
import HomeDashboard from '@/components/home/HomeDashboard.vue';
import NoTeamMessage from '@/components/common/NoTeamMessage.vue';

const { hasTeam } = useAuth();
</script>

<template>
  <div class="home-page">
    <div v-if="hasTeam" class="home-dashboard">
      <h1 class="home-title">À faire</h1>
      <HomeDashboard />
    </div>

    <template v-else>
      <div class="hero">
        <h1>EVA</h1>
        <p class="subtitle">Outil de gestion d'équipe FPS 4v4</p>
      </div>
      <NoTeamMessage />
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// Centred while what it shows fits the screen, by the free space above and
// below it; taller, it starts at the top and scrolls (a centred column would
// spill over its top, out of reach)
.home-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  padding: $spacing-xl;
  @include surface-gradient;

  > :last-child {
    margin-bottom: auto;
  }

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
    padding-top: $spacing-xl;
  }

  @include mobile {
    padding: 0.75rem;
    padding-top: $spacing-lg;
  }
}

// What to do reads from the top, in a column a line of text stays readable in
.home-dashboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  width: 100%;
  max-width: 720px;

  @include mobile-lg {
    gap: $spacing-md;
  }
}

.home-title {
  margin: 0;
  font-size: $font-size-2xl;
  font-weight: 800;
  color: $color-text-primary;

  @include mobile-lg {
    font-size: $font-size-xl;
  }
}

.hero {
  text-align: center;
  margin-top: auto;
  margin-bottom: $spacing-2xl;

  // On a phone, what the page shows starts at the top
  @include mobile-lg {
    margin-top: 0;
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
</style>
