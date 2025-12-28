<script setup lang="ts">
import { computed } from 'vue';
import { posteColors, joueurs as allJoueurs } from '../data/config';
import type { MapConfig, Joueur } from '../types';

const props = defineProps<{
  joueurs: Joueur[];
  selectedJoueurId: string | null;
  map: MapConfig | null;
  activePostes: string[];
  editMode: boolean;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  'select-joueur': [joueurId: string | null];
  'toggle-poste': [posteId: string];
  'toggle-edit': [];
  'save': [];
  'cancel': [];
}>();

// Liste des postes disponibles (depuis la map actuelle ou fallback)
const postes = computed(() => {
  if (props.map && props.map.postes.length > 0) {
    return props.map.postes.map(p => ({ id: p.id, nom: p.nom }));
  }
  // Fallback si pas de map
  return [
    { id: 'poste1', nom: 'Poste 1' },
    { id: 'poste2', nom: 'Poste 2' },
    { id: 'poste3', nom: 'Poste 3' },
    { id: 'poste4', nom: 'Poste 4' },
  ];
});

// Système de vérification de l'équilibre de l'effectif
interface BalanceCheck {
  isBalanced: boolean;
  messages: string[];
}

const balanceCheck = computed<BalanceCheck>(() => {
  if (!props.map) {
    return { isBalanced: true, messages: ['Effectif équilibré'] };
  }

  const errorMessages: string[] = [];

  // Pour chaque poste, trouver les joueurs qui le couvrent
  const posteToPlayers: Record<string, string[]> = {};

  for (const poste of postes.value) {
    posteToPlayers[poste.id] = [];
    for (const [playerId, playerPostes] of Object.entries(props.map.joueurs)) {
      if (playerPostes.includes(poste.id)) {
        const players = posteToPlayers[poste.id];
        if (players) {
          players.push(playerId);
        }
      }
    }
  }

  // Règle 1 : Vérifier si un poste est tenu par moins de 2 joueurs
  for (const [posteId, players] of Object.entries(posteToPlayers)) {
    if (players.length < 2) {
      const poste = postes.value.find(p => p.id === posteId);
      const posteName = poste?.nom || posteId;
      if (players.length === 0) {
        errorMessages.push(`${posteName} n'a aucun joueur`);
      } else {
        const playerName = allJoueurs.find(j => j.id === players[0])?.nom || players[0];
        errorMessages.push(`${posteName} n'a que ${playerName}`);
      }
    }
  }

  // Règle 2 : Vérifier si un joueur ne couvre qu'un seul poste
  for (const [playerId, playerPostes] of Object.entries(props.map.joueurs)) {
    if (playerPostes.length < 2) {
      const playerName = allJoueurs.find(j => j.id === playerId)?.nom || playerId;
      if (playerPostes.length === 0) {
        errorMessages.push(`${playerName} n'a aucun poste`);
      } else {
        const poste = postes.value.find(p => p.id === playerPostes[0]);
        const posteName = poste?.nom || playerPostes[0];
        errorMessages.push(`${playerName} n'a que ${posteName}`);
      }
    }
  }

  // Règle 3 : Trouver les postes couverts par exactement 2 joueurs
  const postesWithTwoPlayers: { posteId: string; players: string[] }[] = [];

  for (const [posteId, players] of Object.entries(posteToPlayers)) {
    if (players.length === 2) {
      postesWithTwoPlayers.push({ posteId, players: players.sort() });
    }
  }

  // Vérifier si deux postes partagent la même paire de joueurs
  const pairToPostes: Record<string, string[]> = {};

  for (const { posteId, players } of postesWithTwoPlayers) {
    const pairKey = players.join('-');
    if (!pairToPostes[pairKey]) {
      pairToPostes[pairKey] = [];
    }
    pairToPostes[pairKey].push(posteId);
  }

  // Trouver les violations de la règle 3 (paires qui couvrent plusieurs postes)
  for (const [pairKey, posteIds] of Object.entries(pairToPostes)) {
    if (posteIds.length > 1) {
      const pair = pairKey.split('-');
      const playerNames = pair.map(pid => {
        const joueur = allJoueurs.find(j => j.id === pid);
        return joueur?.nom || pid;
      });
      const posteNames = posteIds.map(pid => {
        const poste = postes.value.find(p => p.id === pid);
        return poste?.nom || pid;
      });
      errorMessages.push(`${posteNames.join(' et ')} sont couverts uniquement par ${playerNames.join(' et ')}`);
    }
  }

  if (errorMessages.length === 0) {
    return { isBalanced: true, messages: ['Effectif équilibré'] };
  }

  return {
    isBalanced: false,
    messages: errorMessages,
  };
});

// Toggle joueur
function toggleJoueur(joueurId: string) {
  emit('select-joueur', joueurId);
}

// Vérifie si un poste est associé au joueur sélectionné
function isPosteAssociated(posteId: string): boolean {
  if (!props.selectedJoueurId || !props.map) return true;
  const joueurPostes = props.map.joueurs[props.selectedJoueurId] || [];
  return joueurPostes.includes(posteId);
}

// Vérifie si un poste est actif
function isPosteActive(posteId: string): boolean {
  return props.activePostes.includes(posteId);
}

// Toggle poste
function togglePoste(posteId: string) {
  if (!isPosteAssociated(posteId)) return;
  emit('toggle-poste', posteId);
}

// Récupère la couleur d'un poste
function getPosteColor(posteId: string): string {
  return posteColors[posteId] || '#888';
}
</script>

<template>
  <header class="top-bar">
    <!-- Section gauche - Messages -->
    <div class="section-left">
      <div
        class="balance-messages"
        :class="{ 'is-balanced': balanceCheck.isBalanced, 'is-unbalanced': !balanceCheck.isBalanced }"
      >
        <div
          v-for="(msg, index) in balanceCheck.messages"
          :key="index"
          class="balance-message-row"
        >
          <span class="message-icon">{{ balanceCheck.isBalanced ? '✓' : '⚠' }}</span>
          <span class="message-text">{{ msg }}</span>
        </div>
      </div>
    </div>

    <!-- Section centrale - Joueurs + Postes -->
    <div class="section-center">
      <!-- Cartouches joueurs -->
      <nav class="player-bar">
        <button
          v-for="joueur in joueurs"
          :key="joueur.id"
          :class="{ active: selectedJoueurId === joueur.id }"
          @click="toggleJoueur(joueur.id)"
        >
          {{ joueur.nom }}
        </button>
      </nav>

      <!-- Cartouches postes -->
      <nav class="poste-bar">
        <button
          v-for="poste in postes"
          :key="poste.id"
          :class="{
            active: isPosteActive(poste.id),
            disabled: !isPosteAssociated(poste.id)
          }"
          :style="{ '--poste-color': getPosteColor(poste.id) }"
          :disabled="!isPosteAssociated(poste.id)"
          @click="togglePoste(poste.id)"
        >
          {{ poste.nom }}
        </button>
      </nav>
    </div>

    <!-- Section droite - Boutons édition -->
    <div class="section-right">
      <div class="edit-controls">
        <template v-if="editMode">
          <button class="btn-save" @click="$emit('save')">💾 Sauvegarder</button>
          <button class="btn-cancel" @click="$emit('cancel')">✕ Annuler</button>
        </template>
        <button
          class="btn-edit"
          :class="{ active: editMode }"
          @click="$emit('toggle-edit')"
          :disabled="isLoading"
        >
          {{ editMode ? '🔓 Mode Édition' : '🔒 Éditer' }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: stretch;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
  min-height: 70px;
}

.section-left {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
}

.balance-messages {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  max-width: 400px;
}

.balance-message-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.message-icon {
  flex-shrink: 0;
}

.message-text {
  line-height: 1.3;
}

.balance-messages.is-balanced {
  color: #4ecdc4;
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
}

.balance-messages.is-unbalanced {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.section-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.4rem 1rem;
}

.section-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
}

/* Joueurs */
.player-bar {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.player-bar button {
  padding: 0.3rem 0.75rem;
  border: 2px solid #666;
  background: transparent;
  color: #ccc;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.player-bar button:hover {
  background: #3a3a5a;
  border-color: #888;
  color: #fff;
}

.player-bar button.active {
  background: #4a4a8a;
  border-color: #7a7aba;
  color: #fff;
  box-shadow: 0 0 8px rgba(100, 100, 200, 0.3);
}

/* Postes */
.poste-bar {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.poste-bar button {
  padding: 0.25rem 0.7rem;
  border: 2px solid var(--poste-color);
  background: transparent;
  color: var(--poste-color);
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.poste-bar button:hover:not(.disabled) {
  background: color-mix(in srgb, var(--poste-color) 20%, transparent);
}

.poste-bar button.active {
  background: color-mix(in srgb, var(--poste-color) 30%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--poste-color) 40%, transparent);
}

.poste-bar button.disabled {
  border-color: #444;
  color: #555;
  cursor: not-allowed;
  opacity: 0.5;
}

/* Boutons édition */
.edit-controls {
  display: flex;
  gap: 0.5rem;
}

.btn-edit, .btn-save, .btn-cancel {
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit {
  background: #2a2a4a;
  color: #ccc;
  border: 1px solid #444;
}

.btn-edit:hover {
  background: #3a3a5a;
}

.btn-edit.active {
  background: #ff6b6b;
  color: #fff;
  border-color: #ff6b6b;
}

.btn-save {
  background: #4ecdc4;
  color: #1a1a2e;
}

.btn-save:hover {
  background: #5fd9d0;
}

.btn-cancel {
  background: #666;
  color: #fff;
}

.btn-cancel:hover {
  background: #888;
}
</style>

