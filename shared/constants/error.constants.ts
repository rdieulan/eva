// Common error messages - Single source of truth for error messages
// Used by both server and client

import {
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from '@shared/utils/validation.utils';

// ============================================
// Error Messages
// ============================================

export const ERROR = {
  // Generic
  serverError: 'Erreur serveur',
  connectionError: 'Erreur de connexion au serveur',
  requiredFieldsMissing: 'Veuillez remplir tous les champs',
  copyFailed: 'Impossible de copier le lien',

  // Validation (using constants from validation.utils)
  emailInvalid: 'Format d\'email invalide',
  passwordTooShort: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
  passwordNoDigit: 'Le mot de passe doit contenir au moins un chiffre',
  passwordNoUppercase: 'Le mot de passe doit contenir au moins une majuscule',
  nameTooShort: `Le pseudo doit contenir au moins ${NAME_MIN_LENGTH} caractères`,
  nameInvalidChars: 'Le pseudo ne doit contenir que des lettres et des chiffres',
  teamNameTooShort: `Le nom de l'équipe doit contenir au moins ${TEAM_NAME_MIN_LENGTH} caractères`,
  passwordsMismatch: 'Les mots de passe ne correspondent pas',

  // Authentication
  loginFailed: 'Identifiants invalides',
  registrationFailed: 'Erreur lors de l\'inscription',
  passwordChangeFailed: 'Erreur lors du changement de mot de passe',
  unauthorized: 'Non authentifié',
  sessionExpired: 'Session expirée. Veuillez vous reconnecter.',
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
  playersLoadFailed: 'Erreur lors du chargement des joueurs',
  playersNotLoaded: 'Joueurs non chargés',

  // Team
  teamNotFound: 'Aucune équipe trouvée',
  teamCreationFailed: 'Erreur lors de la création de l\'équipe',
  teamFetchFailed: 'Erreur lors de la récupération de l\'équipe',
  teamUpdateFailed: 'Erreur lors de la mise à jour de l\'équipe',
  teamDeleteFailed: 'Erreur lors de la suppression de l\'équipe',
  teamLeaveFailed: 'Erreur lors du départ de l\'équipe',
  teamLocationsFetchFailed: 'Erreur lors de la récupération des localisations',
  teamMembersFetchFailed: 'Erreur lors de la récupération des membres',
  teamMemberRemoveFailed: 'Erreur lors du retrait du membre',
  teamPermissionsUpdateFailed: 'Erreur lors de la mise à jour des permissions',
  teamRequiredForMaps: 'Vous devez appartenir à une équipe pour accéder aux cartes',
  teamRequiredForPlans: 'Vous devez appartenir à une équipe pour accéder aux plans',
  teamRequiredForEvents: 'Vous devez appartenir à une équipe pour créer des événements',
  teamRequiredForCalendar: 'Vous devez appartenir à une équipe pour accéder au calendrier',
  userAlreadyInTeam: 'Vous êtes déjà membre d\'une équipe',
  memberNotFound: 'Membre non trouvé dans cette équipe',
  cannotModifyLeaderPermissions: 'Impossible de modifier les permissions du leader',
  cannotModifyOwnPermissions: 'Impossible de modifier vos propres permissions',
  cannotRemoveLeader: 'Impossible de retirer le leader de l\'équipe',
  cannotRemoveSelf: 'Impossible de vous retirer vous-même',
  onlyLeaderCanDelete: 'Seul le leader peut supprimer l\'équipe',
  leaderCannotLeave: 'Le leader ne peut pas quitter l\'équipe. Supprimez l\'équipe ou transférez la direction.',

  // Invitations
  inviteNotFound: 'Invitation non trouvée',
  inviteExpired: 'Cette invitation a expiré',
  inviteMaxUsesReached: 'Cette invitation a atteint son nombre maximum d\'utilisations',
  inviteCreationFailed: 'Erreur lors de la création de l\'invitation',
  inviteFetchFailed: 'Erreur lors de la récupération des invitations',
  inviteRevokeFailed: 'Erreur lors de la révocation de l\'invitation',
  inviteExpirationInvalid: 'La durée d\'expiration doit être entre 1 et 168 heures',
  inviteMaxUsesInvalid: 'Le nombre d\'utilisations doit être entre 1 et 50',
  inviteCodeMissing: 'Code d\'invitation manquant',
  inviteCodeInvalid: 'Code invalide',
  inviteValidationFailed: 'Erreur lors de la vérification du code',
  inviteInvalid: 'Cette invitation n\'est plus valide',
  joinTeamFailed: 'Erreur lors de la tentative de rejoindre l\'équipe',

  // Calendar
  calendarLoadFailed: 'Erreur lors du chargement du calendrier',
  availabilityUpdateFailed: 'Erreur lors de la mise à jour de la disponibilité',
  eventsLoadFailed: 'Erreur lors du chargement des événements',
  eventNotFound: 'Événement non trouvé',
  eventCreationFailed: 'Erreur lors de la création de l\'événement',
  eventUpdateFailed: 'Erreur lors de la modification de l\'événement',
  eventDeleteFailed: 'Erreur lors de la suppression de l\'événement',
  eventGamePlanUpdateFailed: 'Erreur lors de la mise à jour du plan de jeu',
  eventDateRequired: 'Veuillez sélectionner une date',
  eventTitleRequired: 'Veuillez entrer un titre',
  eventTimeRequired: 'Veuillez renseigner les heures de début et fin',
  eventTimeInvalid: 'L\'heure de fin doit être après l\'heure de début',
  exportPngFailed: 'Erreur lors de l\'export PNG',
  monthParamRequired: 'Paramètre month requis (format YYYY-MM)',
  dateInvalid: 'Date invalide (format YYYY-MM-DD requis)',
  startTimeInvalid: 'Heure de début invalide (format HH:mm requis)',
  endTimeInvalid: 'Heure de fin invalide (format HH:mm requis)',
  titleRequired: 'Titre requis',
  eventTypeInvalid: 'Type invalide (MATCH ou EVENT requis)',
  statusInvalid: 'Status invalide',
  matchOnlyGamePlan: 'Seuls les MATCH peuvent avoir un plan de jeu',

  // Planner / Maps
  mapsLoadFailed: 'Erreur lors du chargement des cartes',
  mapLoadFailed: 'Erreur lors du chargement de la carte',
  mapSaveFailed: 'Erreur lors de la sauvegarde de la carte',
  planNotFound: 'Plan de jeu non trouvé',
  planLoadFailed: 'Erreur lors du chargement du plan',
  plansLoadFailed: 'Erreur lors du chargement des plans',
  planCreationFailed: 'Erreur lors de la création du plan',
  planSaveFailed: 'Erreur lors de la sauvegarde du plan',
  planDuplicationFailed: 'Erreur lors de la duplication du plan',
  planDeletionFailed: 'Erreur lors de la suppression du plan',
  planRenameFailed: 'Erreur lors du renommage du plan',
  mapNotFound: 'Carte non trouvée',
  accessDenied: 'Accès refusé',
  ruleNotFound: 'Règle non trouvée',
  balanceRulesLoadFailed: 'Erreur lors du chargement des règles d\'équilibrage',
  balanceRuleUpdateFailed: 'Erreur lors de la mise à jour de la règle',
  balanceRulesResetFailed: 'Erreur lors de la réinitialisation des règles',
} as const;

export type ErrorMessageKey = keyof typeof ERROR;
