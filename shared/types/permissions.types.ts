// Permissions types for granular access control

/**
 * Planner permissions - control access to game plan features
 */
export interface PlannerPermissions {
  canCreate: boolean;  // Create new game plans
  canEdit: boolean;    // Edit everything (markers, zones, notes, roles, player assignments)
  canDelete: boolean;  // Delete game plans
  canManageBalanceRules: boolean; // Manage balance validation rules
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
 * Matchmaking permissions - who speaks for the team to the other teams
 */
export interface MatchmakingPermissions {
  canSearch: boolean;  // Open, change and withdraw the team's searches for an opponent
  canPropose: boolean; // Propose a match on another team's search, and take the proposal back
  canRespond: boolean; // Accept or decline the proposals on the team's searches; an accepted one lands in the calendar
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
export interface AccountPermissions {
  planner: PlannerPermissions;
  calendar: CalendarPermissions;
  matchmaking: MatchmakingPermissions;
  team: TeamPermissions;
}

/**
 * Default permissions for new players (minimal access)
 */
export const DEFAULT_PLAYER_PERMISSIONS: AccountPermissions = {
  planner: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageBalanceRules: false,
  },
  calendar: {
    canCreateEvents: false,
    canEditEvents: false,
    canDeleteEvents: false,
    canAttachGamePlan: false,
  },
  matchmaking: {
    canSearch: false,
    canPropose: false,
    canRespond: false,
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
export const LEADER_PERMISSIONS: AccountPermissions = {
  planner: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageBalanceRules: true,
  },
  calendar: {
    canCreateEvents: true,
    canEditEvents: true,
    canDeleteEvents: true,
    canAttachGamePlan: true,
  },
  matchmaking: {
    canSearch: true,
    canPropose: true,
    canRespond: true,
  },
  team: {
    canManageTeam: true,
    canInviteMembers: true,
    canRemoveMembers: true,
    canManagePermissions: true,
  },
};

/**
 * Manager permissions structure (venue management focused)
 */
export interface ManagerPermissions {
  venues: {
    canManageVenue: boolean;      // Edit venue info
    canManageCalendar: boolean;   // Manage venue calendar
    canViewStats: boolean;        // View venue statistics
  };
}

/**
 * Default permissions for new managers
 */
export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  venues: {
    canManageVenue: true,
    canManageCalendar: true,
    canViewStats: true,
  },
};

/**
 * Admin permissions structure (system-wide access)
 */
export interface AdminPermissions {
  system: {
    canManageVenues: boolean;     // Create/edit/delete venues
    canManageManagers: boolean;   // Create/edit manager accounts
    canManageAdmins: boolean;     // Create/edit admin accounts (super admin only)
    canViewAllData: boolean;      // Access all data across teams
  };
}

/**
 * Default permissions for new admins
 */
export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  system: {
    canManageVenues: true,
    canManageManagers: true,
    canManageAdmins: false,  // Only super admin can manage other admins
    canViewAllData: true,
  },
};

