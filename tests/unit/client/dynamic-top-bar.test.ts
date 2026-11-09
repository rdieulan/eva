// Tests for the top bar: signing in from a page read without an account comes back to it
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

const push = vi.hoisted(() => vi.fn());
const route = vi.hoisted(() => ({ fullPath: '/', meta: {} as Record<string, unknown> }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => route }));

import DynamicTopBar from '@/components/common/layout/DynamicTopBar.vue';

function mountBar() {
  return mount(DynamicTopBar, {
    props: { isAuthenticated: false },
    global: { stubs: { NotificationBell: true } },
  });
}

beforeEach(() => {
  push.mockReset();
});

describe('DynamicTopBar', () => {
  it('comes back to a venue board after signing in from it', async () => {
    route.fullPath = '/salles/nimes';
    route.meta = { returnAfterLogin: true };

    const login = mountBar().find('.btn-login');
    expect(login.text()).toBe('Se connecter');
    await login.trigger('click');

    expect(push).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/salles/nimes' } });
  });

  it('signs in plainly from any other page', async () => {
    route.fullPath = '/team';
    route.meta = {};

    await mountBar().find('.btn-login').trigger('click');

    expect(push).toHaveBeenCalledWith('/login');
  });
});
