<script setup lang="ts">
import { computed } from 'vue';

// Import all icons
import homeIcon from '@/assets/icons/home.svg?raw';
import userIcon from '@/assets/icons/user.svg?raw';
import logoutIcon from '@/assets/icons/logout.svg?raw';
import closeIcon from '@/assets/icons/close.svg?raw';
import chevronLeftIcon from '@/assets/icons/chevron-left.svg?raw';
import chevronRightIcon from '@/assets/icons/chevron-right.svg?raw';
import resetIcon from '@/assets/icons/reset.svg?raw';
import calculatorIcon from '@/assets/icons/calculator.svg?raw';

const icons: Record<string, string> = {
  home: homeIcon,
  user: userIcon,
  logout: logoutIcon,
  close: closeIcon,
  'chevron-left': chevronLeftIcon,
  'chevron-right': chevronRightIcon,
  reset: resetIcon,
  calculator: calculatorIcon,
};

const props = withDefaults(
  defineProps<{
    name: keyof typeof icons;
    size?: string;
  }>(),
  {
    size: '1em',
  }
);

const svgContent = computed(() => icons[props.name] || '');
</script>

<template>
  <span
    class="svg-icon"
    :style="{ width: size, height: size }"
    v-html="svgContent"
  ></span>
</template>

<style scoped lang="scss">
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  :deep(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}
</style>

