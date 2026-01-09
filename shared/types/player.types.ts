// Player types

export interface Player {
  id: string;   // cuid from database
  name: string;
}

// Player assignment in a game plan (links userId to assignment IDs)
export interface PlayerAssignment {
  userId: string;
  assignmentIds: number[];
  mainAssignmentId?: number; // Primary/preferred assignment ID
}

