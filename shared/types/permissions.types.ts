// Permissions types for granular access control

/**
 * Planner permissions - control access to game plan features
 */
export interface PlannerPermissions {
  canCreate: boolean;  // Create new game plans
  canEdit: boolean;    // Edit everything (markers, zones, notes, roles, player assignments)
  canDelete: boolean;  // Delete game plans
}

/**
 * Calendar permissions - control access to calendar features
 */
export interface CalendarPermissions {
  canCreateEvents: boolean;    // Create MATCH/EVENT
  canEditEvents: boolean;      // Modify existing events
  canDeleteEvents: boolean;    // Delete events
  canAttachGamePlan: boolean;  // Attach game plan to match
}

/**
 * Team permissions - control access to team management
 */
export interface TeamPermissions {
  canManageTeam: boolean;       // Edit team info (name, logo, location)
  canInviteMembers: boolean;    // Invite new members
  canRemoveMembers: boolean;    // Remove members from team
  canManagePermissions: boolean; // Modify member permissions
}

/**
 * Complete user permissions structure
 */
export interface UserPermissions {
  planner: PlannerPermissions;
  calendar: CalendarPermissions;
  team: TeamPermissions;
}

/**
 * Default permissions for new players (minimal access)
 */
export const DEFAULT_PLAYER_PERMISSIONS: UserPermissions = {
  planner: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
  calendar: {
    canCreateEvents: false,
    canEditEvents: false,
    canDeleteEvents: false,
    canAttachGamePlan: false,
  },
  team: {
    canManageTeam: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canManagePermissions: false,
  },
};

/**
 * Full permissions for team leaders
 */
export const LEADER_PERMISSIONS: UserPermissions = {
  planner: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  calendar: {
    canCreateEvents: true,
    canEditEvents: true,
    canDeleteEvents: true,
    canAttachGamePlan: true,
  },
  team: {
    canManageTeam: true,
    canInviteMembers: true,
    canRemoveMembers: true,
    canManagePermissions: true,
  },
};
