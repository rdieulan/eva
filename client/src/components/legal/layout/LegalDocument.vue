<script setup lang="ts">
import LegalLinks from '@/components/legal/LegalLinks.vue';

// The page of a legal text, the legal notice or the page on personal data:
// its title, when it last changed, then its sections, set as a document to
// read, and the way to the other legal page at its foot. Layout only: the
// text is the page's.
defineProps<{
  title: string;
  updated?: string; // When the text last changed, as it reads ("13 novembre 2026")
}>();
</script>

<template>
  <div class="legal-page">
    <article class="legal-document">
      <header class="legal-header">
        <h1>{{ title }}</h1>
        <p v-if="updated" class="legal-updated">Mise à jour le {{ updated }}</p>
      </header>
      <slot />
    </article>
    <LegalLinks class="legal-foot" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.legal-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-lg;
  padding: $spacing-xl;
  @include surface-gradient;
  overflow-y: auto;

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
  }

  @include mobile {
    padding: 0.75rem;
  }
}

// One card, a column of text no wider than a line can be read across
.legal-document {
  width: 100%;
  max-width: 720px;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-xl;
  color: $color-text-primary;
  font-size: $font-size-sm;
  line-height: 1.6;

  @include mobile-lg {
    padding: 1.25rem;
    border-radius: 10px;
  }

  @include mobile {
    padding: $spacing-md;
  }

  // The sections are the page's: reach them through the scope. Each opens on
  // its heading, set apart from what comes before it.
  :slotted(h2) {
    color: $color-accent;
    margin: $spacing-lg 0 $spacing-sm;
    font-size: 1.1rem;
    font-weight: 600;

    @include mobile-lg {
      font-size: 1rem;
    }
  }

  :slotted(p) {
    margin: 0 0 $spacing-sm;
  }

  :slotted(ul) {
    margin: 0 0 $spacing-sm;
    padding-left: 1.25rem;
  }

  :slotted(li + li) {
    margin-top: $spacing-xs;
  }

  :slotted(a) {
    color: $color-accent;
  }

  :slotted(.error-display) {
    margin: 0 0 $spacing-md;
  }
}

.legal-header {
  margin-bottom: $spacing-sm;

  h1 {
    margin: 0;
    color: $color-white;
    font-size: 1.75rem;
    line-height: 1.2;

    @include mobile-lg {
      font-size: 1.5rem;
    }

    @include mobile {
      font-size: 1.35rem;
    }
  }
}

.legal-updated {
  margin: $spacing-xs 0 0;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.legal-foot {
  padding-bottom: $spacing-md;
}
</style>
