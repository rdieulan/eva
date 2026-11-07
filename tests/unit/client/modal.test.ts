// Tests for the modal shell: modals opened over one another
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import Modal from '@/components/common/Modal.vue';

const mounted: VueWrapper[] = [];

function mountModal(open = true) {
  const wrapper = mount(Modal, { props: { open, title: 'Fenêtre' }, global: { stubs: { Teleport: true } } });
  mounted.push(wrapper);
  return wrapper;
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

function layerOf(wrapper: VueWrapper): number {
  return Number((wrapper.find('.modal-backdrop').element as HTMLElement).style.zIndex);
}

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount());
});

describe('Modal over another modal', () => {
  it('closes the modal on top with Escape, the one under it on the next', async () => {
    const under = mountModal();
    const top = mountModal();

    pressEscape();
    expect(top.emitted('close')).toHaveLength(1);
    expect(under.emitted('close')).toBeFalsy();

    await top.setProps({ open: false });
    pressEscape();
    expect(under.emitted('close')).toHaveLength(1);
    expect(top.emitted('close')).toHaveLength(1);
  });

  it('keeps the page from scrolling until the last modal open closes', async () => {
    const under = mountModal();
    const top = mountModal();
    expect(document.body.style.overflow).toBe('hidden');

    await top.setProps({ open: false });
    expect(document.body.style.overflow).toBe('hidden');

    await under.setProps({ open: false });
    expect(document.body.style.overflow).toBe('');
  });

  it('puts each modal opened above the ones already open, wherever it sits in the page', async () => {
    // Mounted first, opened last: it still goes on top
    const later = mountModal(false);
    const first = mountModal();
    const second = mountModal();
    expect(layerOf(second)).toBeGreaterThan(layerOf(first));

    await first.setProps({ open: false });
    await later.setProps({ open: true });
    expect(layerOf(later)).toBeGreaterThan(layerOf(second));
  });

  it('leaves the stack when it goes away open', async () => {
    const under = mountModal();
    const top = mountModal();

    top.unmount();
    mounted.splice(mounted.indexOf(top), 1);
    pressEscape();

    expect(under.emitted('close')).toHaveLength(1);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
