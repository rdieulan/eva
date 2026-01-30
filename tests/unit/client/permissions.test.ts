/**
 * Permissions Tests
 *
 * Tests that verify permission-based access control works correctly:
 * - Components show/hide elements based on permissions
 * - Correct permissions are passed to child components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, computed } from 'vue';
import type { UserPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS, LEADER_PERMISSIONS } from '@shared/types';

// Component imports
import PlanSelector from '@/components/planner/PlanSelector.vue';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';

// Mock SvgIcon component
vi.mock('@/components/common/SvgIcon.vue', () => ({
  default: {
    name: 'SvgIcon',
    props: ['name'],
    template: '<span class="svg-icon"></span>',
  },
}));

// Mock Modal component
vi.mock('@/components/common/Modal.vue', () => ({
  default: {
    name: 'Modal',
    props: ['open', 'title', 'size', 'showCloseButton'],
    template: '<div v-if="open" class="modal"><slot name="header"></slot><slot></slot><slot name="footer"></slot></div>',
  },
}));

// Mock ConfirmModal component
vi.mock('@/components/common/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    props: ['open', 'title', 'message', 'danger'],
    template: '<div v-if="open" class="confirm-modal"></div>',
  },
}));

// Mock GamePlanViewer component
vi.mock('@/components/common/GamePlanViewer.vue', () => ({
  default: {
    name: 'GamePlanViewer',
    props: ['gamePlan'],
    template: '<div class="game-plan-viewer"></div>',
  },
}));

// Mock RotationCalculatorModal component
vi.mock('@/components/common/rotation/RotationCalculatorModal.vue', () => ({
  default: {
    name: 'RotationCalculatorModal',
    props: ['open', 'maps', 'players', 'mode', 'initialGamePlan'],
    template: '<div v-if="open" class="rotation-calculator-modal"></div>',
  },
}));

describe('Permissions Tests', () => {
  describe('DEFAULT_PLAYER_PERMISSIONS', () => {
    it('should have all permissions set to false', () => {
      expect(DEFAULT_PLAYER_PERMISSIONS.planner.canCreate).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.planner.canEdit).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.planner.canDelete).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.calendar.canCreateEvents).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.calendar.canEditEvents).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.calendar.canDeleteEvents).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.calendar.canAttachGamePlan).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.team.canManageTeam).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.team.canInviteMembers).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.team.canRemoveMembers).toBe(false);
      expect(DEFAULT_PLAYER_PERMISSIONS.team.canManagePermissions).toBe(false);
    });
  });

  describe('LEADER_PERMISSIONS', () => {
    it('should have all permissions set to true', () => {
      expect(LEADER_PERMISSIONS.planner.canCreate).toBe(true);
      expect(LEADER_PERMISSIONS.planner.canEdit).toBe(true);
      expect(LEADER_PERMISSIONS.planner.canDelete).toBe(true);
      expect(LEADER_PERMISSIONS.calendar.canCreateEvents).toBe(true);
      expect(LEADER_PERMISSIONS.calendar.canEditEvents).toBe(true);
      expect(LEADER_PERMISSIONS.calendar.canDeleteEvents).toBe(true);
      expect(LEADER_PERMISSIONS.calendar.canAttachGamePlan).toBe(true);
      expect(LEADER_PERMISSIONS.team.canManageTeam).toBe(true);
      expect(LEADER_PERMISSIONS.team.canInviteMembers).toBe(true);
      expect(LEADER_PERMISSIONS.team.canRemoveMembers).toBe(true);
      expect(LEADER_PERMISSIONS.team.canManagePermissions).toBe(true);
    });
  });

  describe('PlanSelector Component', () => {
    const mockPlans = [
      { id: 'plan-1', name: 'Plan A', assignments: [], players: [] },
      { id: 'plan-2', name: 'Plan B', assignments: [], players: [] },
    ];

    it('should receive canCreate prop correctly', () => {
      const wrapperWithCreate = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          canCreate: true,
          canEdit: false,
          canDelete: false,
        },
      });

      const wrapperWithoutCreate = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });

      expect(wrapperWithCreate.props('canCreate')).toBe(true);
      expect(wrapperWithoutCreate.props('canCreate')).toBe(false);
    });

    it('should receive canEdit prop correctly', () => {
      const wrapperWithEdit = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          canCreate: false,
          canEdit: true,
          canDelete: false,
        },
      });

      const wrapperWithoutEdit = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });

      expect(wrapperWithEdit.props('canEdit')).toBe(true);
      expect(wrapperWithoutEdit.props('canEdit')).toBe(false);
    });

    it('should receive canDelete prop correctly', () => {
      const wrapperWithDelete = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          canCreate: false,
          canEdit: false,
          canDelete: true,
        },
      });

      const wrapperWithoutDelete = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });

      expect(wrapperWithDelete.props('canDelete')).toBe(true);
      expect(wrapperWithoutDelete.props('canDelete')).toBe(false);
    });

    it('should have all permission props default to false', () => {
      const wrapper = mount(PlanSelector, {
        props: {
          plans: mockPlans,
          selectedPlanId: 'plan-1',
          // Not passing permission props - should default to false
        },
      });

      expect(wrapper.props('canCreate')).toBe(false);
      expect(wrapper.props('canEdit')).toBe(false);
      expect(wrapper.props('canDelete')).toBe(false);
    });
  });

  describe('EventFormModal Component', () => {
    const mockEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '20:00',
      endTime: '22:00',
      type: 'MATCH' as const,
      title: 'Test Match',
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('should be in view-only mode when canEdit is false for existing event', () => {
      const wrapper = mount(EventFormModal, {
        props: {
          open: true,
          editEvent: mockEvent,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });

      // Should render view-only mode
      expect(wrapper.find('.event-view').exists()).toBe(true);
    });

    it('should show edit form when canEdit is true', () => {
      const wrapper = mount(EventFormModal, {
        props: {
          open: true,
          editEvent: mockEvent,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        },
      });

      // Should render edit form, not view-only
      expect(wrapper.find('.event-form').exists()).toBe(true);
      expect(wrapper.find('.event-view').exists()).toBe(false);
    });

    it('should hide delete button when canDelete is false', () => {
      const wrapper = mount(EventFormModal, {
        props: {
          open: true,
          editEvent: mockEvent,
          canCreate: true,
          canEdit: true,
          canDelete: false,
        },
      });

      expect(wrapper.find('.btn-danger').exists()).toBe(false);
    });

    it('should show delete button when canDelete is true', () => {
      const wrapper = mount(EventFormModal, {
        props: {
          open: true,
          editEvent: mockEvent,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        },
      });

      expect(wrapper.find('.btn-danger').exists()).toBe(true);
    });

    it('should hide game plan button when canAttachGamePlan is false', () => {
      const wrapper = mount(EventFormModal, {
        props: {
          open: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canAttachGamePlan: false,
          maps: [{ id: 'map-1', name: 'Map 1', images: [], assignments: [], players: [] }],
          players: [{ id: 'p-1', name: 'Player 1' }],
        },
      });

      // Game plan button should not exist when canAttachGamePlan is false
      expect(wrapper.find('.btn-set-gameplan').exists()).toBe(false);
    });
  });

  describe('EventViewerModal Component', () => {
    const mockEvents = [
      {
        id: 'event-1',
        date: '2026-12-20', // Future date
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH' as const,
        title: 'Test Match',
        createdById: 'admin-1',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    it('should show edit button when canEdit is true', () => {
      const wrapper = mount(EventViewerModal, {
        props: {
          events: mockEvents,
          canCreate: false,
          canEdit: true,
          canDelete: false,
        },
      });

      const editBtn = wrapper.find('.btn-primary');
      expect(editBtn.exists()).toBe(true);
      expect(editBtn.text()).toContain('Modifier');
    });

    it('should hide edit button when canEdit is false', () => {
      const wrapper = mount(EventViewerModal, {
        props: {
          events: mockEvents,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });

      const editBtn = wrapper.find('.btn-primary');
      expect(editBtn.exists()).toBe(false);
    });

    it('should show add button when canCreate is true', () => {
      const wrapper = mount(EventViewerModal, {
        props: {
          events: mockEvents,
          canCreate: true,
          canEdit: false,
          canDelete: false,
        },
      });

      const addBtn = wrapper.find('.btn-accent');
      expect(addBtn.exists()).toBe(true);
      expect(addBtn.text()).toContain('Ajouter');
    });

    it('should hide add button when canCreate is false', () => {
      const wrapper = mount(EventViewerModal, {
        props: {
          events: mockEvents,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        },
      });

      const addBtn = wrapper.find('.btn-accent');
      expect(addBtn.exists()).toBe(false);
    });

    it('should hide admin actions for past events even with permissions', () => {
      const pastEvents = [
        {
          ...mockEvents[0],
          date: '2020-01-01', // Past date
        },
      ];

      const wrapper = mount(EventViewerModal, {
        props: {
          events: pastEvents,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        },
      });

      // Admin actions should be hidden for past events
      expect(wrapper.find('.admin-actions').exists()).toBe(false);
    });
  });
});
