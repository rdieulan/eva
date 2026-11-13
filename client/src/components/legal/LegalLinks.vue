<script setup lang="ts">
// The way to the legal pages, at the foot of the pages that carry it: signing
// in, the profile, a venue's public board, and the legal pages themselves (see
// "Pages légales" in docs/PRODUIT.md)
</script>

<template>
  <nav class="legal-links" aria-label="Informations légales">
    <RouterLink :to="{ name: 'legal-notice' }">Mentions légales</RouterLink>
    <span class="legal-links-dot" aria-hidden="true">·</span>
    <RouterLink :to="{ name: 'privacy' }">Données personnelles</RouterLink>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// A quiet line, centred: it is there to be found, not to be read first
.legal-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: $spacing-xs $spacing-sm;
  font-size: $font-size-xs;
  color: $color-text-secondary;

  a {
    color: inherit;
    text-decoration: none;

    &:hover,
    &:focus-visible {
      color: $color-text-primary;
      text-decoration: underline;
    }
  }
}
</style>
