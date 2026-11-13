<script lang="ts">
/** A fact of a legal page: its label, its value, and where the value leads when it is an address to write to */
export interface LegalFact {
  label: string;
  value: string | null; // Null: the deployment has not given it
  href?: string;
}
</script>

<script setup lang="ts">
// The facts of a legal page, a label then its value: who publishes the site,
// who hosts it. A value the deployment has not given says so, rather than
// leaving a blank.
defineProps<{
  facts: LegalFact[];
}>();
</script>

<template>
  <dl class="legal-facts">
    <div v-for="fact in facts" :key="fact.label" class="legal-fact">
      <dt>{{ fact.label }}</dt>
      <dd>
        <a v-if="fact.value && fact.href" :href="fact.href">{{ fact.value }}</a>
        <template v-else-if="fact.value">{{ fact.value }}</template>
        <span v-else class="legal-missing">Non renseigné</span>
      </dd>
    </div>
  </dl>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// A label column and a value column; on a phone, the label above its value
.legal-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: $spacing-xs $spacing-md;
  margin: 0 0 $spacing-sm;

  @include mobile-lg {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.legal-fact {
  display: contents;

  @include mobile-lg {
    display: block;

    & + & {
      margin-top: $spacing-sm;
    }
  }
}

dt {
  color: $color-text-secondary;
}

dd {
  margin: 0;
  color: $color-white;
  overflow-wrap: anywhere;

  a {
    color: $color-accent;
  }
}

.legal-missing {
  color: $color-text-muted;
  font-style: italic;
}
</style>
