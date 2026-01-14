<script setup lang="ts">
import { ref } from 'vue';
import SvgIcon from '@/components/common/SvgIcon.vue';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  icon?: string;
  position?: 'left' | 'right';
  width?: string;
}>(), {
  position: 'right',
  width: '320px',
  icon: 'notes',
});

const emit = defineEmits<{
  'update:modelValue': [open: boolean];
}>();

const isTransitioning = ref(false);

function toggle() {
  emit('update:modelValue', !props.modelValue);
}
</script>

<template>
  <div
    class="drawer"
    :class="[position, { open: modelValue }]"
    :style="{ '--drawer-width': width }"
  >
    <!-- Drawer content (overlay) with attached tab -->
    <Transition :name="position === 'right' ? 'slide-right' : 'slide-left'" @before-leave="isTransitioning = true" @after-leave="isTransitioning = false">
      <div v-if="modelValue" class="drawer-overlay">
        <!-- Tab attached to drawer (outside, top) -->
        <button class="drawer-tab" @click="toggle" :title="title">
          <SvgIcon :name="icon" class="tab-icon" />
          <SvgIcon name="chevron-right" class="tab-chevron" />
        </button>

        <div v-if="title || $slots.header" class="drawer-header">
          <slot name="header">
            <h2>{{ title }}</h2>
          </slot>
        </div>

        <div class="drawer-content">
          <slot></slot>
        </div>

        <div v-if="$slots.footer" class="drawer-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </Transition>

    <!-- Toggle tab (visible when closed and not transitioning) -->
    <button v-if="!modelValue && !isTransitioning" class="drawer-tab closed" @click="toggle" :title="title">
      <SvgIcon :name="icon" class="tab-icon" />
      <SvgIcon name="chevron-right" class="tab-chevron" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// Tab dimensions
$tab-width: 28px;
$tab-height: 56px;
$tab-top: $spacing-md;

.drawer {
  position: relative;
  flex-shrink: 0;
  width: 0;
  z-index: 50;
}

.drawer-tab {
  position: absolute;
  top: $tab-top;
  width: $tab-width;
  height: $tab-height;
  padding: $spacing-xs 0;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  cursor: pointer;
  color: $color-text-secondary;
  transition: background 0.15s, color 0.15s;
  z-index: 51;

  &:hover {
    background: $color-bg-tertiary;
    color: $color-text-primary;
  }

  .tab-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  .tab-chevron {
    width: 14px;
    height: 14px;
    fill: currentColor;
    transition: transform 0.25s ease;
  }

  &.closed .tab-chevron {
    transform: rotate(180deg);
  }
}

// Right position
.drawer.right {
  .drawer-tab {
    // Always outside on the left of the drawer
    left: calc(-1 * #{$tab-width});
    right: auto;
    border-right: none;
    border-radius: $radius-md 0 0 $radius-md;

    // Closed: stick to right edge of container
    &.closed {
      left: auto;
      right: 0;
    }
  }

  .drawer-overlay {
    right: 0;
    border-left: 1px solid $color-border;
  }
}

// Left position
.drawer.left {
  order: -1;

  .drawer-tab {
    // Always outside on the right of the drawer
    right: calc(-1 * #{$tab-width});
    left: auto;
    border-left: none;
    border-radius: 0 $radius-md $radius-md 0;

    .tab-chevron {
      transform: rotate(180deg);
    }

    // Closed: stick to left edge of container
    &.closed {
      right: auto;
      left: 0;

      .tab-chevron {
        transform: rotate(0deg);
      }
    }
  }

  .drawer-overlay {
    left: 0;
    border-right: 1px solid $color-border;
  }
}

.drawer-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--drawer-width);
  background: $color-bg-secondary;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  z-index: 50;

  @include mobile-lg {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 50vh;
    border-left: none !important;
    border-right: none !important;
    border-top: 1px solid $color-border;
  }
}

.drawer-header {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(#{$tab-top} + #{$tab-height});
  margin: 0 $spacing-md;
  border-bottom: 1px solid $color-border;
  flex-shrink: 0;

  h2 {
    margin: 0;
    color: $color-text-primary;
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-md;
}

.drawer-footer {
  flex-shrink: 0;
  padding: $spacing-sm $spacing-md;
  border-top: 1px solid $color-border;
}

// Transitions
.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.25s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

// Mobile
@include mobile-lg {
  .drawer-tab {
    top: auto;
    left: 50%;
    right: auto;
    width: 80px;
    height: 32px;
    border-radius: $radius-md $radius-md 0 0;
    border: 1px solid $color-border;
    border-bottom: none;
    bottom: auto;
    top: calc(-1 * 32px);
    transform: translateX(-50%);

    .tab-chevron {
      transform: rotate(-90deg);
    }

    &.closed {
      top: auto;
      bottom: 0;
      transform: translateX(-50%);

      .tab-chevron {
        transform: rotate(90deg);
      }
    }
  }

  .slide-right-enter-from,
  .slide-right-leave-to,
  .slide-left-enter-from,
  .slide-left-leave-to {
    transform: translateY(100%);
  }
}
</style>

