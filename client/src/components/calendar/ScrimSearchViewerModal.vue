<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import PlannedEventsNote from '@/components/calendar/PlannedEventsNote.vue';
import {
  deleteScrimSearch,
  createScrimProposal,
  acceptScrimProposal,
  declineScrimProposal,
  withdrawScrimProposal,
} from '@/api';
import { useErrors } from '@/composables/useErrors';
import type { CalendarEvent, ScrimProposal, ScrimProposalStatus, ScrimSearch, Venue, VenueSlot } from '@shared/types';
import { ERROR, SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH } from '@shared/constants';
import { describeProposalDecline } from '@shared/utils';
import { formatLongDate, isPastDateStr } from '@/utils/calendar';
import { describeMatchesWanted, searchVenueIds } from '@/utils/scrims';
import { formatVenueLabel } from '@/utils/venues';

// A search as the calendar shows it: its day, who offers which slots, when, in
// which venues, for how many matches of which length. Another team answers it
// from here by picking the run of the match it wants to play, in one of the
// venues. The team that opened it reads its offer venue by venue as the search
// window showed it, the answers, takes some or turns them down, changes the
// search or withdraws it; it knows who it is, so the sheet does not say.
const props = withDefaults(defineProps<{
  search: ScrimSearch | null; // Open while set
  venues: Venue[]; // To name the venues of the search
  canSearch: boolean; // The reader may change and withdraw the team's searches
  canPropose: boolean; // The reader may propose a match on another team's search, and take it back
  canRespond: boolean; // The reader may accept or decline the proposals on the team's searches
  plannedEvents?: CalendarEvent[]; // What the reader's team planned that day, to pick the hours of an answer around it
}>(), {
  plannedEvents: () => [],
});

const emit = defineEmits<{
  close: [];
  changed: [opts: { matched: boolean }]; // Something moved; the calendar reloads, its events too when a match was made
  edit: [search: ScrimSearch]; // Our own search, to change in the search window
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const confirmWithdraw = ref(false);
const isBusy = ref(false);
const message = ref('');
const run = ref<{ venueId: string; slots: VenueSlot[] } | null>(null); // The run the reader's team wants to play, in one venue
const sent = ref(false); // A proposal just left, before the calendar reloads

// The matches already made stay in both calendars: withdrawing only stops the search for more
const withdrawMessage = computed(() => {
  const made = props.search?.matchedCount ?? 0;
  const kept = made === 0 ? '' : made > 1 ? ' Les matchs déjà calés restent.' : ' Le match déjà calé reste.';
  return `Les autres équipes ne verront plus ces créneaux, et leurs propositions en attente tomberont.${kept} Retirer la recherche ?`;
});

watch(() => props.search, () => {
  clearErrors();
  confirmWithdraw.value = false;
  isBusy.value = false;
  message.value = '';
  run.value = null;
  sent.value = false;
});

// The venues the search offers slots in, in the team's order
const offeredVenueIds = computed(() => (props.search ? searchVenueIds(props.search) : []));

function venueLabel(venueId: string): string {
  const venue = props.venues.find(candidate => candidate.id === venueId);
  return venue ? formatVenueLabel(venue) : 'Salle inconnue';
}

// The slots the search offers in a venue, and those no other match can take there
function offeredIn(venueId: string): string[] {
  return props.search?.slots.filter(slot => slot.venueId === venueId).map(slot => slot.slotId) ?? [];
}

function takenIn(venueId: string): string[] {
  const offered = new Set(offeredIn(venueId));
  return props.search?.takenSlotIds.filter(slotId => offered.has(slotId)) ?? [];
}

// Picking a run in a venue drops the one picked in another: a proposal is one match
function pickRun(venueId: string, slots: VenueSlot[]) {
  run.value = slots.length ? { venueId, slots } : null;
}

function pickedIn(venueId: string): string[] {
  return run.value?.venueId === venueId ? run.value.slots.map(slot => slot.slotId) : [];
}

const isMine = computed(() => props.search?.isMine ?? false);

// Our own search changes until its day comes
const canEdit = computed(() => isMine.value && props.canSearch && !!props.search && !isPastDateStr(props.search.date));

// Another team's search: the latest proposal the reader's team sent, if any.
// Once one is answered the team may send another, so the older ones only say
// what they once became.
const ownProposal = computed<ScrimProposal | null>(() => {
  if (!props.search || isMine.value) return null;
  return props.search.proposals
    .filter(proposal => proposal.isMine)
    .reduce<ScrimProposal | null>((latest, proposal) => (!latest || proposal.createdAt > latest.createdAt ? proposal : latest), null);
});

// The reader's own search: the proposals waiting for an answer
const pendingProposals = computed(() =>
  props.search && isMine.value ? props.search.proposals.filter(proposal => proposal.status === 'PENDING') : [],
);

const mayPropose = computed(() => props.canPropose && !isMine.value && !sent.value && (!ownProposal.value || ownProposal.value.status !== 'PENDING'));

const OWN_PROPOSAL_LABELS: Record<Exclude<ScrimProposalStatus, 'DECLINED'>, string> = {
  PENDING: 'Proposition envoyée, en attente de leur réponse',
  ACCEPTED: 'Proposition acceptée',
  WITHDRAWN: 'Proposition retirée',
  CANCELLED: 'Match annulé',
};

// What became of the team's proposal; a declined one says why, in the words of
// the notification the team received
const ownOutcome = computed<{ title: string; detail: string | null } | null>(() => {
  const proposal = ownProposal.value;
  if (!proposal) return null;
  if (proposal.status === 'DECLINED') return describeProposalDecline(proposal.declineReason);
  return { title: OWN_PROPOSAL_LABELS[proposal.status], detail: null };
});

function offeredSummary(search: ScrimSearch): string {
  const count = search.slots.length > 1 ? `${search.slots.length} créneaux proposés` : '1 créneau proposé';
  const places = new Set(search.slots.map(slot => `${slot.venueId}:${slot.arenaNumber}`));
  const arena = places.size === 1 ? `, arène ${search.slots[0]!.arenaNumber}` : '';
  return `${count} entre ${search.startTime} et ${search.endTime}${arena}`;
}

// Our own offer in a venue: the slots still open to a match, those at the time
// of a match made apart
function openIn(venueId: string): string[] {
  const taken = new Set(takenIn(venueId));
  return offeredIn(venueId).filter(slotId => !taken.has(slotId));
}

// The run a proposal names; where, when the search spans several venues
function runSummary(proposal: ScrimProposal): string {
  const count = proposal.evaSlotIds.length > 1 ? `${proposal.evaSlotIds.length} créneaux` : '1 créneau';
  const where = offeredVenueIds.value.length > 1 ? `${venueLabel(proposal.venueId)} · ` : '';
  return `${where}${proposal.startTime} – ${proposal.endTime} (${count}), arène ${proposal.arenaNumber}, convocation à ${proposal.convocationTime}`;
}

async function act(action: () => Promise<void>, fallback: string, after: { matched: boolean; close: boolean }) {
  if (isBusy.value) return;
  isBusy.value = true;
  clearErrors();
  try {
    await action();
    emit('changed', { matched: after.matched });
    if (after.close) emit('close');
  } catch (error) {
    setErrorFromException(error, fallback);
  } finally {
    isBusy.value = false;
  }
}

function withdrawSearch() {
  confirmWithdraw.value = false;
  if (!props.search) return;
  const id = props.search.id;
  act(() => deleteScrimSearch(id), ERROR.scrimSearchDeleteFailed, { matched: false, close: true });
}

function propose() {
  if (!props.search || !run.value) return;
  const id = props.search.id;
  const text = message.value.trim();
  const evaSlotIds = run.value.slots.map(slot => slot.slotId);
  act(async () => {
    await createScrimProposal(id, text ? { evaSlotIds, message: text } : { evaSlotIds });
    sent.value = true;
  }, ERROR.scrimProposalCreateFailed, { matched: false, close: false });
}

function withdrawProposal() {
  if (!ownProposal.value) return;
  const id = ownProposal.value.id;
  act(() => withdrawScrimProposal(id), ERROR.scrimProposalWithdrawFailed, { matched: false, close: true });
}

function accept(proposal: ScrimProposal) {
  act(async () => { await acceptScrimProposal(proposal.id); }, ERROR.scrimProposalRespondFailed, { matched: true, close: true });
}

function decline(proposal: ScrimProposal) {
  act(async () => { await declineScrimProposal(proposal.id); }, ERROR.scrimProposalRespondFailed, { matched: false, close: false });
}
</script>

<template>
  <Modal :open="search !== null" size="md" :close-on-backdrop="!isBusy" @close="emit('close')">
    <template #header>
      <h2 class="modal-title">
        🔎 {{ isMine ? 'Notre recherche' : 'Recherche d\'adversaire' }}<span v-if="search" class="title-day"> · {{ formatLongDate(search.date) }}</span>
      </h2>
    </template>

    <div v-if="search" class="details">
      <ErrorDisplay :errors="errors" />

      <div v-if="!isMine" class="team">
        <img v-if="search.team.logoUrl" class="team-logo" :src="search.team.logoUrl" :alt="`Logo de ${search.team.name}`" />
        <span class="team-name">{{ search.team.name }}</span>
        <span class="team-hint">cherche un adversaire</span>
      </div>

      <dl class="facts">
        <div class="fact">
          <dt>Matchs</dt>
          <dd>{{ describeMatchesWanted(search) }}</dd>
        </div>
        <template v-if="!isMine">
          <div class="fact">
            <dt>Créneaux</dt>
            <dd>{{ offeredSummary(search) }}</dd>
          </div>
          <div class="fact">
            <dt>{{ offeredVenueIds.length > 1 ? 'Salles' : 'Salle' }}</dt>
            <dd>{{ offeredVenueIds.map(venueLabel).join(', ') }}</dd>
          </div>
        </template>
      </dl>

      <!-- Our own search: the offer venue by venue, as the search window showed it, nothing to click -->
      <section v-if="isMine" class="offer">
        <div v-for="venueId in offeredVenueIds" :key="venueId" class="venue-offer">
          <VenueSlotPicker
            :venue-id="venueId"
            :date="search.date"
            :label="venueLabel(venueId)"
            heading
            :model-value="openIn(venueId)"
            :excluded-slot-ids="takenIn(venueId)"
            excluded-note="Match calé"
            selection="free"
            playable-only
            readonly
          />
        </div>
      </section>

      <!-- Another team's search: pick the run to play and answer, or see what became of the answer -->
      <section v-if="!isMine && canPropose" class="propose">
        <p v-if="sent" class="status status--pending" role="status">{{ OWN_PROPOSAL_LABELS.PENDING }}</p>
        <template v-else-if="ownProposal && ownProposal.status === 'PENDING'">
          <p class="status status--pending">{{ OWN_PROPOSAL_LABELS.PENDING }}</p>
          <p class="own-run">{{ runSummary(ownProposal) }}</p>
          <button type="button" class="btn btn-text" :disabled="isBusy" @click="withdrawProposal">Retirer la proposition</button>
        </template>
        <template v-else>
          <div v-if="ownProposal && ownOutcome" class="outcome">
            <p class="status" :class="`status--${ownProposal.status.toLowerCase()}`">{{ ownOutcome.title }}</p>
            <p v-if="ownOutcome.detail" class="outcome-detail">{{ ownOutcome.detail }}</p>
          </div>
          <PlannedEventsNote :events="plannedEvents" />
          <div v-for="venueId in offeredVenueIds" :key="venueId" class="venue-run">
            <VenueSlotPicker
              :venue-id="venueId"
              :date="search.date"
              :label="venueLabel(venueId)"
              heading
              :model-value="pickedIn(venueId)"
              :allowed-slot-ids="offeredIn(venueId)"
              :excluded-slot-ids="takenIn(venueId)"
              excluded-note="Heure déjà prise"
              selection="run"
              :run-length="search.slotCount"
              playable-only
              :disabled="isBusy"
              @select="slots => pickRun(venueId, slots)"
            />
          </div>
          <label class="message-field">
            <span>Un mot pour leur équipe (facultatif)</span>
            <textarea
              v-model="message"
              rows="2"
              :maxlength="SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH"
              :disabled="isBusy"
              placeholder="On est quatre, dispo pour un bo3 ?"
            ></textarea>
          </label>
        </template>
      </section>

      <!-- The reader's own search: the answers so far -->
      <section v-if="isMine" class="proposals">
        <h3 class="proposals-title">
          {{ pendingProposals.length === 0 ? 'Aucune proposition pour le moment' : pendingProposals.length === 1 ? '1 proposition' : `${pendingProposals.length} propositions` }}
        </h3>
        <ul v-if="pendingProposals.length" class="proposal-list">
          <li v-for="proposal in pendingProposals" :key="proposal.id" class="proposal">
            <div class="proposal-team">
              <img v-if="proposal.team.logoUrl" class="proposal-logo" :src="proposal.team.logoUrl" alt="" />
              <span class="proposal-name">{{ proposal.team.name }}</span>
            </div>
            <p class="proposal-run">{{ runSummary(proposal) }}</p>
            <p v-if="proposal.message" class="proposal-message">« {{ proposal.message }} »</p>
            <div v-if="canRespond" class="proposal-actions">
              <button type="button" class="btn btn-accept" :disabled="isBusy" @click="accept(proposal)">✅ Accepter</button>
              <button type="button" class="btn btn-decline" :disabled="isBusy" @click="decline(proposal)">Refuser</button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <template #footer>
      <div class="footer-actions">
        <button
          v-if="isMine && canSearch"
          type="button"
          class="btn btn-danger"
          :disabled="isBusy"
          @click="confirmWithdraw = true"
        >
          Retirer la recherche
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="btn btn-primary"
          :disabled="isBusy"
          @click="search && emit('edit', search)"
        >
          Modifier la recherche
        </button>
        <button
          v-if="mayPropose"
          type="button"
          class="btn btn-primary"
          :disabled="isBusy || !run"
          :title="!run ? 'Choisis d\'abord les créneaux du match' : undefined"
          @click="propose"
        >
          {{ isBusy ? 'Envoi…' : '🤝 Proposer un match' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="isBusy" @click="emit('close')">Fermer</button>
      </div>
    </template>
  </Modal>

  <ConfirmModal
    :open="confirmWithdraw"
    title="Retirer la recherche"
    :message="withdrawMessage"
    confirm-text="Retirer"
    :danger="true"
    @confirm="withdrawSearch"
    @cancel="confirmWithdraw = false"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.modal-title {
  margin: 0;
  font-size: $font-size-xl;
  color: $color-white;
}

// The day of the search, after what it is
.title-day {
  color: $color-text-secondary;
  font-weight: 500;
}

.details {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.team {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.team-logo {
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  object-fit: cover;
  background: $color-bg-secondary;
}

.team-name {
  color: $color-white;
  font-weight: 700;
  font-size: $font-size-lg;
}

.team-hint {
  color: $color-text-secondary;
}

.facts {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin: 0;
}

.fact {
  display: flex;
  flex-direction: column;
  gap: 2px;

  dt {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  dd {
    margin: 0;
    color: $color-white;
  }
}


.propose,
.proposals {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding-top: $spacing-md;
  border-top: $border-thin solid $color-border-light;
}

.status {
  margin: 0;
  font-weight: 600;

  &--pending {
    color: $color-conditional;
  }

  &--declined,
  &--withdrawn,
  &--cancelled {
    color: $color-text-secondary;
  }

  &--accepted {
    color: $color-success;
  }
}

// What became of our proposal, and why under it
.outcome {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.outcome-detail {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.own-run,
.proposal-run {
  margin: 0;
  color: $color-white;
  font-size: $font-size-sm;
}

// Each venue of the search, its name above its slots (see VenueSlotPicker)
.venue-run + .venue-run,
.venue-offer + .venue-offer {
  margin-top: $spacing-sm;
}

.offer {
  display: flex;
  flex-direction: column;
}

.message-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  span {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  textarea {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-secondary;
    border: $border-thin solid $color-border-light;
    border-radius: $radius-md;
    color: $color-white;
    font: inherit;
    resize: vertical;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

.proposals-title {
  margin: 0;
  font-size: $font-size-base;
  color: $color-white;
}

.proposal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.proposal {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
}

.proposal-team {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.proposal-logo {
  width: 24px;
  height: 24px;
  border-radius: $radius-sm;
  object-fit: cover;
}

.proposal-name {
  color: $color-white;
  font-weight: 600;
}

.proposal-message {
  margin: 0;
  color: $color-text-secondary;
  font-style: italic;
}

.proposal-actions {
  display: flex;
  gap: $spacing-sm;
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.btn-secondary {
  @include btn-base($color-text-secondary);
}

.btn-primary {
  @include btn-base($color-accent);
}

.btn-danger {
  @include btn-base($color-danger);
}

.btn-accept {
  @include btn-base($color-success);
  padding: $spacing-xs $spacing-md;
}

.btn-decline {
  @include btn-base($color-text-secondary);
  padding: $spacing-xs $spacing-md;
}

.btn-text {
  align-self: flex-start;
  padding: 0;
  background: none;
  border: none;
  color: $color-text-secondary;
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: $color-white;
  }
}
</style>
