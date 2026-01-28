// Common error messages - Single source of truth for error messages
// Used by both server and client

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  // Generic
  serverError: 'Erreur serveur',
  connectionError: 'Erreur de connexion au serveur',
  requiredFieldsMissing: 'Veuillez remplir tous les champs',
  copyFailed: 'Impossible de copier le lien',

  // Authentication
  loginFailed: 'Identifiants invalides',
  registrationFailed: 'Erreur lors de l\'inscription',
  passwordChangeFailed: 'Erreur lors du changement de mot de passe',
  unauthorized: 'Non authentifié',
  forbidden: 'Permission refusée',
  tokenMissing: 'Token manquant',
  tokenInvalid: 'Token invalide',
  emailAndPasswordRequired: 'Email et mot de passe requis',
  emailPasswordNameRequired: 'Email, mot de passe et pseudo requis',
  emailAlreadyUsed: 'Cette adresse email est déjà utilisée',
  currentAndNewPasswordRequired: 'Mot de passe actuel et nouveau requis',
  currentPasswordIncorrect: 'Mot de passe actuel incorrect',

  // User
  userNotFound: 'Utilisateur non trouvé',

  // Team
  teamNotFound: 'Aucune équipe trouvée',
  teamCreationFailed: 'Erreur lors de la création de l\'équipe',
  teamRequiredForMaps: 'Vous devez appartenir à une équipe pour accéder aux cartes',
  teamRequiredForPlans: 'Vous devez appartenir à une équipe pour accéder aux plans',
  teamRequiredForEvents: 'Vous devez appartenir à une équipe pour créer des événements',

  // Invitations
  inviteNotFound: 'Invitation non trouvée',
  inviteExpired: 'Cette invitation a expiré',
  inviteMaxUsesReached: 'Cette invitation a atteint son nombre maximum d\'utilisations',
  inviteCreationFailed: 'Erreur lors de la création de l\'invitation',
  inviteExpirationInvalid: 'La durée d\'expiration doit être entre 1 et 168 heures',
  inviteMaxUsesInvalid: 'Le nombre d\'utilisations doit être entre 1 et 50',
  inviteCodeMissing: 'Code d\'invitation manquant',
  inviteValidationFailed: 'Erreur lors de la validation',
  inviteInvalid: 'Cette invitation n\'est plus valide',
  joinTeamFailed: 'Erreur lors de la tentative de rejoindre l\'équipe',

  // Calendar
  eventNotFound: 'Événement non trouvé',
  eventCreationFailed: 'Erreur lors de la création de l\'événement',
  monthParamRequired: 'Paramètre month requis (format YYYY-MM)',
  dateInvalid: 'Date invalide (format YYYY-MM-DD requis)',
  startTimeInvalid: 'Heure de début invalide (format HH:mm requis)',
  endTimeInvalid: 'Heure de fin invalide (format HH:mm requis)',
  titleRequired: 'Titre requis',
  eventTypeInvalid: 'Type invalide (MATCH ou EVENT requis)',
  statusInvalid: 'Status invalide',
  matchOnlyGamePlan: 'Seuls les MATCH peuvent avoir un plan de jeu',

  // Planner / Maps
  planNotFound: 'Plan de jeu non trouvé',
  mapNotFound: 'Carte non trouvée',
  accessDenied: 'Accès refusé',
  ruleNotFound: 'Règle non trouvée',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
