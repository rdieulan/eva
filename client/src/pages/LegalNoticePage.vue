<script setup lang="ts">
import LegalDocument from '@/components/legal/layout/LegalDocument.vue';
import LegalFacts, { type LegalFact } from '@/components/legal/LegalFacts.vue';
import { APP_NAME } from '@shared/constants';
import { HOST } from '@/constants/legal';

// The legal notice, as the law on the digital economy asks (article 1-1 of the
// LCEN). The app is published on a non-professional basis: its publisher gave
// their identity to the host rather than to the public, as section II allows,
// which asks only for the host's name and address. Where to reach the
// publisher about personal data is on that page, as the GDPR asks. See
// "Pages légales" in docs/PRODUIT.md.
const hostFacts: LegalFact[] = [
  { label: 'Société', value: HOST.name },
  { label: 'Adresse', value: HOST.address },
  { label: 'Téléphone', value: HOST.phone },
];
</script>

<template>
  <LegalDocument title="Mentions légales">
    <section>
      <h2>Éditeur du site</h2>
      <p>
        {{ APP_NAME }} est publié à titre non professionnel par une personne physique. Comme le permet l'article 1-1, II de
        la loi pour la confiance dans l'économie numérique, elle a communiqué son identité à l'hébergeur ci-dessous, tenu
        de la garder secrète, sauf devant la justice.
      </p>
    </section>

    <section>
      <h2>Hébergement et stockage des données</h2>
      <LegalFacts :facts="hostFacts" />
      <p>Les données de l'application sont stockées dans la région Europe de Railway, à {{ HOST.dataLocation }}.</p>
    </section>

    <section>
      <h2>{{ APP_NAME }} et eva.gg</h2>
      <p>{{ APP_NAME }} est un outil indépendant : il n'est ni édité ni approuvé par eva.gg.</p>
    </section>

    <section>
      <h2>Données personnelles</h2>
      <p>
        Ce que l'application garde de toi, qui le voit, combien de temps, et à qui écrire à leur sujet : voir la page
        <RouterLink :to="{ name: 'privacy' }">Données personnelles</RouterLink>.
      </p>
    </section>
  </LegalDocument>
</template>
