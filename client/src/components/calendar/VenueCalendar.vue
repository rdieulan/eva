<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { VenueCalendarItem } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchVenueCalendar } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { useCalendarNavigation } from '@/composables/useCalendarNavigation';
import type { CalendarDay } from '@/utils/calendar';
import CalendarNav from '@/components/calendar/layout/CalendarNav.vue';
import CalendarViewSwitch from '@/components/calendar/layout/CalendarViewSwitch.vue';
import WeekdayNames from '@/components/calendar/layout/WeekdayNames.vue';
import MonthLayout from '@/components/calendar/layout/MonthLayout.vue';
import WeekLayout from '@/components/calendar/layout/WeekLayout.vue';
import DayCell from '@/components/calendar/DayCell.vue';
import DayAgendaModal, { type DayAgenda } from '@/components/calendar/DayAgendaModal.vue';
import VenueCalendarItemModal from '@/components/calendar/VenueCalendarItemModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

// The calendar of a venue: the competitions and the events it publishes, and
// the matches teams play there, laid out as the team's calendar is, by month
// or by week, its days read by no team. A day opens what it holds, and the
// whole day when its rows run over.
const props = defineProps<{
  venueId: string;
}>();

const { viewMode, currentYear, currentMonth, currentWeekStart, monthsInSight, navigationTitle, goToPrev, goToNext } =
  useCalendarNavigation();
const { errors, setErrorFromException, clearErrors } = useErrors();

const items = ref<VenueCalendarItem[]>([]);
const isLoading = ref(true);

// The days of every month in sight, a week across two months showing all of
// its. An answer that arrives after other months were asked for is dropped:
// it would show the wrong days.
let loadRequestId = 0;

async function load() {
  const requestId = ++loadRequestId;
  isLoading.value = true;
  clearErrors();
  try {
    const loaded = await Promise.all(monthsInSight.value.map(month => fetchVenueCalendar(props.venueId, month)));
    if (requestId !== loadRequestId) return;
    items.value = loaded.flat();
  } catch (error) {
    if (requestId !== loadRequestId) return;
    setErrorFromException(error, ERROR.venueCalendarFetchFailed);
  } finally {
    if (requestId === loadRequestId) isLoading.value = false;
  }
}

watch(() => monthsInSight.value.join(','), load, { immediate: true });

// What the venue holds each day in sight; the days around a month hold
// nothing, as in the team's calendar
const itemsByDate = computed(() => {
  const byDate: Record<string, VenueCalendarItem[]> = {};
  for (const item of items.value) (byDate[item.date] ??= []).push(item);
  return byDate;
});

function itemsOf(day: CalendarDay): VenueCalendarItem[] {
  return day.isCurrentMonth ? itemsByDate.value[day.date] ?? [] : [];
}

// A day listed whole, from the row that counts what its rows leave out
const agendaDate = ref<string | null>(null);
const agendaDay = computed<DayAgenda<VenueCalendarItem> | null>(() => {
  const date = agendaDate.value;
  if (!date) return null;
  return { date, searches: [], events: itemsByDate.value[date] ?? [], renewals: [], venueEvents: [] };
});

// What is looked at, from a day or from its list, in place of the list
const viewed = ref<VenueCalendarItem | null>(null);

function open(dayItems: VenueCalendarItem[], index: number) {
  agendaDate.value = null;
  viewed.value = dayItems[index] ?? null;
}
</script>

<template>
  <div class="venue-calendar">
    <!-- When (centre), how (right), as in the team's calendar -->
    <div class="venue-calendar-controls">
      <CalendarNav class="venue-calendar-nav" :view-mode="viewMode" :title="navigationTitle" @prev="goToPrev" @next="goToNext" />
      <CalendarViewSwitch v-model="viewMode" class="venue-calendar-view" />
    </div>

    <ErrorDisplay :errors="errors" />

    <div class="venue-calendar-days" :class="{ 'is-loading': isLoading }" :aria-busy="isLoading">
      <template v-if="viewMode === 'month'">
        <WeekdayNames />
        <MonthLayout :year="currentYear" :month="currentMonth">
          <template #day="{ day }">
            <DayCell
              venue
              :date="day.date"
              :day-number="day.dayNumber"
              :is-current-month="day.isCurrentMonth"
              :is-today="day.isToday"
              :is-past="day.isPast"
              :current-player-status="null"
              :player-availabilities="[]"
              :events="itemsOf(day)"
              @open-event-viewer="open"
              @open-day="date => (agendaDate = date)"
            />
          </template>
        </MonthLayout>
      </template>

      <WeekLayout v-else :week-start="currentWeekStart" :month="currentMonth">
        <template #day="{ day }">
          <DayCell
            venue
            :date="day.date"
            :day-number="day.dayNumber"
            :is-current-month="day.isCurrentMonth"
            :is-today="day.isToday"
            :is-past="day.isPast"
            :current-player-status="null"
            :player-availabilities="[]"
            :events="itemsOf(day)"
            :show-day-number="false"
            @open-event-viewer="open"
            @open-day="date => (agendaDate = date)"
          />
        </template>
      </WeekLayout>
    </div>

    <DayAgendaModal :day="agendaDay" @close="agendaDate = null" @open-event-viewer="open" />
    <VenueCalendarItemModal :item="viewed" @close="viewed = null" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.venue-calendar {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

// The month or the week in sight in the middle, how it is laid out on the right
.venue-calendar-controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: $spacing-md;

  @include mobile-lg {
    grid-template-columns: 1fr;
    gap: $spacing-sm;
  }
}

.venue-calendar-nav {
  grid-column: 2;

  @include mobile-lg {
    grid-column: 1;
  }
}

.venue-calendar-view {
  justify-self: end;
}

// The days as the team's calendar lays them out, a step apart from the
// names of the days
.venue-calendar-days {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  transition: opacity 0.15s ease-out;

  // Another month on its way: the days fade, their place kept
  &.is-loading {
    opacity: 0.55;
  }
}
</style>
