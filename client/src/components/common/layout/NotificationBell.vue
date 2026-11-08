<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SvgIcon from '@/components/common/SvgIcon.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { useNotifications } from '@/composables/useNotifications';
import { useErrors } from '@/composables/useErrors';
import { describeNotification } from '@shared/utils';
import { ERROR } from '@shared/constants';
import type { InboxNotification } from '@shared/types';
import { formatRelativeTime } from '@/utils/notifications';
import { calendarRoute } from '@/utils/calendar';

// Above this many, the badge stops counting
const BADGE_MAX = 9;

const router = useRouter();
const { unreadCount, notifications, isLoading, start, stop, open } = useNotifications();
const { errors, setErrorFromException, clearErrors } = useErrors();

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
// The list hangs from the bottom of the bar, whatever its height, its right edge on the bell's
const panelTop = ref(0);
const panelRight = ref(0);

const badge = computed(() => (unreadCount.value > BADGE_MAX ? `${BADGE_MAX}+` : String(unreadCount.value)));
const buttonLabel = computed(() => (unreadCount.value
  ? `Notifications, ${unreadCount.value} non lue${unreadCount.value > 1 ? 's' : ''}`
  : 'Notifications'));

// Each notification put in words once, with how long ago it came
const items = computed(() => notifications.value.map(notification => ({
  notification,
  description: describeNotification(notification),
  when: formatRelativeTime(notification.createdAt),
})));

async function toggle() {
  if (isOpen.value) {
    isOpen.value = false;
    return;
  }
  panelTop.value = root.value?.closest('header')?.getBoundingClientRect().bottom ?? 0;
  panelRight.value = window.innerWidth - (root.value?.getBoundingClientRect().right ?? window.innerWidth);
  isOpen.value = true;
  clearErrors();
  try {
    await open();
  } catch (error) {
    setErrorFromException(error, ERROR.notificationsLoadFailed);
  }
}

function follow(notification: InboxNotification) {
  isOpen.value = false;
  router.push(calendarRoute(describeNotification(notification).target));
}

// A click anywhere else, or Escape, closes the list
function closeOnOutsideClick(event: MouseEvent) {
  if (isOpen.value && root.value && !root.value.contains(event.target as Node)) isOpen.value = false;
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') isOpen.value = false;
}

// Placed for the window it opened in
function closeOnResize() {
  isOpen.value = false;
}

onMounted(() => {
  start();
  document.addEventListener('click', closeOnOutsideClick);
  document.addEventListener('keydown', closeOnEscape);
  window.addEventListener('resize', closeOnResize);
});

onBeforeUnmount(() => {
  stop();
  document.removeEventListener('click', closeOnOutsideClick);
  document.removeEventListener('keydown', closeOnEscape);
  window.removeEventListener('resize', closeOnResize);
});
</script>

<template>
  <div ref="root" class="notification-bell">
    <button
      type="button"
      class="btn-bell"
      :class="{ open: isOpen }"
      :title="buttonLabel"
      :aria-label="buttonLabel"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <SvgIcon name="bell" class="bell-icon" />
      <span v-if="unreadCount" class="badge" aria-hidden="true">{{ badge }}</span>
    </button>

    <div v-if="isOpen" class="panel" role="region" aria-label="Notifications" :style="{ '--panel-top': `${panelTop}px`, '--panel-right': `${panelRight}px` }">
      <p class="panel-title">Notifications</p>
      <ErrorDisplay :errors="errors" />
      <p v-if="isLoading && !items.length" class="panel-note">Chargement…</p>
      <p v-else-if="!items.length && !errors.length" class="panel-note">Aucune notification pour le moment.</p>
      <ul v-else class="list">
        <li v-for="{ notification, description, when } in items" :key="notification.id">
          <button type="button" class="item" :class="{ unread: !notification.isRead }" @click="follow(notification)">
            <span class="item-head">
              <span class="item-title">{{ description.title }}</span>
              <span class="item-when">{{ when }}</span>
            </span>
            <span class="item-body">{{ description.body }}</span>
            <span v-if="description.detail" class="item-detail">{{ description.detail }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

$panel-layer: 900; // Over the page, under any modal (Modal.vue opens them from 1000)

.notification-bell {
  position: relative;
  display: flex;
  align-items: center;
}

// Same frame as the account button beside it, square
.btn-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: $border-thick solid with-alpha($color-accent, 0.4);
  border-radius: 6px;
  background: transparent;
  color: $color-accent;
  cursor: pointer;
  transition: all 0.2s;

  &:hover,
  &.open {
    background: $color-bg-tertiary;
    border-color: $color-accent;
    color: $color-white;
  }

  @include mobile {
    width: 36px;
    height: 36px;
  }
}

.bell-icon {
  width: 22px !important;
  height: 22px !important;
  fill: currentColor;
}

.badge {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid $color-bg-secondary;
  border-radius: 999px;
  background: $color-danger;
  color: $color-white;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  box-sizing: border-box;
}

.panel {
  position: fixed;
  top: calc(var(--panel-top) + #{$spacing-xs});
  right: var(--panel-right);
  z-index: $panel-layer;
  width: 22rem;
  max-height: min(70vh, 32rem);
  overflow-y: auto;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);

  // A phone gives the list its whole width, under the bar
  @include mobile {
    top: var(--panel-top);
    left: 0;
    right: 0;
    width: auto;
    max-height: calc(100vh - var(--panel-top));
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}

.panel-title {
  margin: 0;
  padding: 0.75rem $spacing-md;
  border-bottom: $border-thin solid $color-border;
  color: $color-white;
  font-weight: 600;
  font-size: $font-size-sm;
}

.panel-note {
  margin: 0;
  padding: $spacing-md;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;

  li + li {
    border-top: $border-thin solid $color-border;
  }
}

.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 0.65rem $spacing-md;
  border: none;
  border-left: 3px solid transparent;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: $color-bg-tertiary;
  }

  // New since the bell last opened
  &.unread {
    border-left-color: $color-accent;
    background: with-alpha($color-accent, 0.08);

    &:hover {
      background: with-alpha($color-accent, 0.14);
    }
  }
}

.item-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-sm;
}

.item-title {
  color: $color-white;
  font-weight: 600;
  font-size: $font-size-sm;
}

.item-when {
  flex-shrink: 0;
  color: $color-text-muted;
  font-size: $font-size-xs;
}

.item-body {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.item-detail {
  color: $color-text-muted;
  font-size: $font-size-xs;
}
</style>
