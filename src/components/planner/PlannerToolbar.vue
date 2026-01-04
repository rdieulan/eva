<script setup lang="ts">
import { computed, ref } from 'vue';
import { posteColors, checkMapBalance } from '../../data/config';
import type { MapConfig, Joueur } from '../../types';
import RotationCalculator from '../RotationCalculator.vue';

const props = defineProps<{
  joueurs: Joueur[];
  selectedJoueurId: string | null;
  map: MapConfig | null;
  maps: MapConfig[];
  activePostes: string[];
  editMode: boolean;
  isLoading: boolean;
  canEdit: boolean;
}>();

const showCalculator = ref(false);

const emit = defineEmits<{
  'select-joueur': [joueurId: string | null];
  'toggle-poste': [posteId: string];
  'toggle-edit': [];
  'save': [];
  'cancel': [];
  'reset': [];
}>();

// Liste des postes disponibles (depuis la map actuelle ou fallback)
const postes = computed(() => {
  if (props.map && props.map.postes.length > 0) {
    return props.map.postes.map(p => ({ id: p.id, nom: p.nom }));
  }
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

  const result = checkMapBalance(props.map);

  if (result.isBalanced) {
    return { isBalanced: true, messages: ['Effectif équilibré'] };
  }

  return {
    isBalanced: false,
    messages: result.errors,
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

// Vérifie si un joueur est associé au poste sélectionné (pour highlight)
function isJoueurHighlighted(joueurId: string): boolean {
  if (props.activePostes.length === 0 || !props.map) return false;
  const selectedPosteId = props.activePostes[0] as string;
  const joueurPostes: string[] = props.map.joueurs[joueurId] ?? [];
  return joueurPostes.includes(selectedPosteId);
}
</script>

<template>
  <div class="planner-toolbar">
    <!-- Section gauche - Messages -->
    <div class="section-left">
    <!-- Icône calculateur -->
    <button
      class="btn-calculator"
      @click="showCalculator = true"
      title="Ouvrir le calculateur de rotation"
    >
      <svg viewBox="0 0 24 24" class="calculator-icon">
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
        <path d="M7 12l1.5-1.5M8.5 10.5L7 9M7 9l1.5 1.5M8.5 10.5L7 12" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M7 17l1.5-1.5M8.5 15.5L7 14M7 14l1.5 1.5M8.5 15.5L7 17" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M16 12l1.5-1.5M17.5 10.5L16 9M16 9l1.5 1.5M17.5 10.5L16 12" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M16 17l1.5-1.5M17.5 15.5L16 14M16 14l1.5 1.5M17.5 15.5L16 17" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <circle cx="12" cy="10" r="1.5"/>
        <circle cx="12" cy="15" r="1.5"/>
        <path d="M10 11.5l-1.5 1.5M14 11.5l1.5 1.5" stroke="currentColor" stroke-width="1" fill="none"/>
      </svg>
    </button>

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
    <!-- Bloc cartouches -->
    <div class="cartouches-wrapper">
      <!-- Cartouches joueurs -->
      <nav class="player-bar">
        <button
          v-for="joueur in joueurs"
          :key="joueur.id"
          :class="{
            active: selectedJoueurId === joueur.id,
            highlighted: isJoueurHighlighted(joueur.id)
          }"
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

    <!-- Bloc reset -->
    <div class="reset-wrapper">
      <button
        class="btn-reset"
        @click="$emit('reset')"
        title="Réinitialiser la sélection"
      >
        <svg viewBox="0 0 24 24" class="reset-icon">
          <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Section droite - Boutons édition (admin seulement) -->
  <div class="section-right">
    <div v-if="canEdit" class="edit-controls">
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
  </div>

  <!-- Modale calculateur de rotation -->
  <RotationCalculator
    v-if="showCalculator"
    :maps="maps"
    :joueurs="joueurs"
    @close="showCalculator = false"
  />
</template>

<style scoped>
.planner-toolbar {
  display: flex;
  flex: 1;
  align-items: stretch;
  width: 100%;
}

.section-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  min-width: 0;
}

.section-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 1rem;
  flex-shrink: 0;
}

.section-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
  min-width: 0;
}

.btn-calculator {
  width: 44px;
  height: 44px;
  border: none;
  background: #2a2a4a;
  border-radius: 8px;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-calculator:hover {
  background: #3a3a5a;
  transform: scale(1.05);
}

.calculator-icon {
  width: 100%;
  height: 100%;
  fill: #4ade80;
  color: #4ade80;
}

.btn-calculator:hover .calculator-icon {
  fill: #6ee7a0;
  color: #6ee7a0;
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
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.balance-messages.is-unbalanced {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
}


.cartouches-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reset-wrapper {
  display: flex;
  align-items: center;
}

.btn-reset {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reset-icon {
  width: 32px;
  height: 32px;
  fill: #888;
  transition: transform 0.3s, fill 0.2s;
}

.btn-reset:hover .reset-icon {
  fill: #fff;
  transform: rotate(90deg);
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

.player-bar button.highlighted {
  border-color: white;
}

.player-bar button.highlighted.active {
  background: linear-gradient(135deg, #4a4a8a 0%, rgba(74, 222, 128, 0.3) 100%);
  border-color: white;
  color: #fff;
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

