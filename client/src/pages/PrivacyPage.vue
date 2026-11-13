<script setup lang="ts">
import { computed } from 'vue';
import LegalDocument from '@/components/legal/layout/LegalDocument.vue';
import LegalFacts, { type LegalFact } from '@/components/legal/LegalFacts.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { usePublisher } from '@/composables/usePublisher';
import { APP_NAME, NOTIFICATION_RETENTION_DAYS } from '@shared/constants';
import { CNIL_COMPLAINT_URL, HOST, PRIVACY_UPDATED } from '@/constants/legal';

// What the app does with personal data, as the GDPR asks to tell (article 13):
// who is responsible, what is kept and why, who sees it, for how long, the
// rights of each, the cookies. It says what the code does: a change there
// changes this page (see docs/CODE_RULES.md).
const { publisher, errors } = usePublisher();

const email = computed(() => publisher.value?.email ?? null);

const controllerFacts = computed<LegalFact[]>(() => [
  { label: 'Nom', value: publisher.value?.name ?? null },
  { label: 'E-mail', value: email.value, href: email.value ? `mailto:${email.value}` : undefined },
]);
</script>

<template>
  <LegalDocument title="Données personnelles" :updated="PRIVACY_UPDATED">
    <ErrorDisplay :errors="errors" />

    <p>Ce que {{ APP_NAME }} garde de toi, pourquoi, qui le voit, combien de temps, et tes droits.</p>

    <section>
      <h2>Qui en est responsable</h2>
      <p>La personne qui publie {{ APP_NAME }} est responsable de tes données. Pour toute question ou demande à leur sujet, écris-lui.</p>
      <LegalFacts v-if="publisher" :facts="controllerFacts" />
    </section>

    <section>
      <h2>Ce que l'application garde, et pourquoi</h2>
      <ul>
        <li>
          <strong>Ton compte Discord</strong> : son numéro et ton pseudo, que tu changes sur ton profil. La connexion passe
          par Discord, qui ne donne que ça : ni ton e-mail ni ton mot de passe. Pour te connecter, et te montrer aux autres sous ton pseudo.
        </li>
        <li>
          <strong>Ton compte eva.gg</strong>, que tu relies toi-même : son numéro et ton pseudo eva.gg. Pour que ton équipe,
          et celle que tu demandes à rejoindre, sachent qui tu es sur eva.gg.
        </li>
        <li>
          <strong>Ton EVA Pass</strong>, si tu le donnes : son palier et sa date de renouvellement. Pour montrer à ton équipe,
          dans son calendrier, le jour où il se renouvelle.
        </li>
        <li><strong>Ton équipe</strong> : celle dont tu fais partie, et tes droits dans l'équipe.</li>
        <li>
          <strong>Tes dispos</strong> : pour chaque jour, ta réponse, et tes horaires si tu en donnes. Pour montrer à ton équipe quand elle peut jouer.
        </li>
        <li>
          <strong>Ce que tu fais pour ton équipe</strong> : les événements du calendrier, les recherches d'adversaire, les
          propositions de match et le mot que tu y joins, les demandes pour rejoindre une équipe, les liens d'invitation.
        </li>
        <li><strong>Tes notifications</strong> : ce que la cloche te montre.</li>
        <li>
          <strong>Ta session</strong> : un jeton, dans un cookie, qui te garde connecté. La base n'en garde qu'une empreinte,
          qui ne permet pas de le retrouver.
        </li>
        <li><strong>Si tu es gérant de salle ou administrateur</strong> : ce rôle, et les salles qui te sont confiées.</li>
      </ul>
      <p>
        Ces données servent à te rendre le service que tu demandes en créant ton compte (article 6.1.b du RGPD). Ce que tu as
        créé pour ton équipe et qui lui reste après la suppression de ton compte repose sur son intérêt à garder son calendrier
        entier (article 6.1.f).
      </p>
      <p>
        Sans compte Discord, pas de connexion, et un joueur relie son compte eva.gg avant le reste. Tout le reste est facultatif :
        l'EVA Pass, les dispos, l'équipe.
      </p>
    </section>

    <section>
      <h2>Qui les voit</h2>
      <ul>
        <li><strong>Ton équipe</strong> : ton pseudo, tes dispos et leurs horaires, le renouvellement de ton EVA Pass, ce que tu fais pour elle.</li>
        <li><strong>Une équipe que tu demandes à rejoindre</strong> : ton pseudo et ton compte eva.gg.</li>
        <li>
          <strong>Les autres équipes, et quiconque ouvre la page publique d'une salle</strong> : ce que ton équipe montre en
          matchmaking, son nom, son logo, ses recherches, et à l'équipe concernée ses propositions et leur mot.
        </li>
        <li><strong>Les gérants de salle</strong> : les matchs et les compétitions de ton équipe dans leur salle.</li>
        <li><strong>Les administrateurs de l'application</strong> : les comptes, avec leur pseudo, leur équipe, leur compte eva.gg et leurs rôles, pour la gérer.</li>
        <li>
          <strong>Discord</strong> : quand ton équipe relie un salon Discord, ses notifications y sont publiées avec les pseudos
          qu'elles portent, par exemple celui et le compte eva.gg de qui demande à la rejoindre. Discord est une société
          américaine dont les serveurs sont aux États-Unis : ce transfert repose sur sa certification au Data Privacy Framework,
          reconnu par la Commission européenne.
        </li>
        <li><strong>eva.gg</strong> : quand tu relies ton compte, l'application envoie le pseudo que tu donnes au site public d'eva.gg, pour le retrouver.</li>
        <li>
          <strong>Railway</strong>, l'hébergeur : il stocke les données dans sa région Europe, à {{ HOST.dataLocation }}. Railway
          Corporation est une société américaine, elle aussi certifiée au Data Privacy Framework selon
          <a :href="HOST.privacyPolicyUrl" target="_blank" rel="noopener">sa politique de confidentialité</a>.
        </li>
      </ul>
      <p>Personne d'autre : pas de publicité, pas de revente, pas de mesure d'audience.</p>
    </section>

    <section>
      <h2>Combien de temps</h2>
      <ul>
        <li><strong>Ton compte et ce qui s'y rattache</strong> : tant que ton compte existe.</li>
        <li><strong>Tes notifications</strong> : {{ NOTIFICATION_RETENTION_DAYS }} jours.</li>
        <li><strong>Ta session</strong> : 30 jours, prolongés tant que tu reviens, 90 jours au plus, puis effacée peu après.</li>
        <li>
          <strong>Une demande pour rejoindre que tu as annulée ou qu'une équipe a refusée</strong> : tant que ton compte existe.
          Elle espace tes demandes à la même équipe, ou t'empêche de la redemander.
        </li>
        <li>
          <strong>À la suppression de ton compte</strong> : ce qui est à toi est effacé, compte, dispos, sessions, notifications,
          demandes et liens d'invitation. Ce que tu as créé pour ton équipe, événements, recherches et propositions, lui reste,
          sans ton nom. Une notification reçue par d'autres qui te nomme s'efface d'elle-même avec les autres, au bout de
          {{ NOTIFICATION_RETENTION_DAYS }} jours ; ce qui a été publié dans le salon Discord d'une équipe y reste, c'est son salon.
        </li>
      </ul>
    </section>

    <section>
      <h2>Tes droits</h2>
      <p>
        Tu peux demander à voir tes données, à les corriger, à les effacer avec ton compte, à en limiter l'usage, à t'y opposer,
        ou à les recevoir dans un format lisible par une machine : écris à
        <a v-if="email" :href="`mailto:${email}`">{{ email }}</a><template v-else>l'adresse donnée en haut de cette page</template>.
        Ton pseudo se change directement sur ton profil.
      </p>
      <p>
        Tu peux aussi adresser une réclamation à la CNIL :
        <a :href="CNIL_COMPLAINT_URL" target="_blank" rel="noopener">cnil.fr/fr/plaintes</a>.
      </p>
    </section>

    <section>
      <h2>Cookies et stockage du navigateur</h2>
      <p>L'application ne dépose que ce qui la fait fonctionner :</p>
      <ul>
        <li>un cookie de session, qui te garde connecté ;</li>
        <li>un cookie de connexion, le temps de passer par Discord, 10 minutes au plus ;</li>
        <li>
          dans le stockage du navigateur, le thème que tu choisis, et une marque de session qui permet à tes autres onglets de
          suivre ta connexion.
        </li>
      </ul>
      <p>Aucun cookie de mesure d'audience ni de publicité.</p>
    </section>
  </LegalDocument>
</template>
