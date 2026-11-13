// What the legal pages show of who publishes the app, as the deployment sets
// it (PUBLISHER_* settings): never written in the code, the repository being
// public. The publisher keeps their identity known to the host only, as the
// law allows a non-professional publisher; the page on personal data names
// them, as the GDPR asks of whoever is responsible for the data.

/** Who publishes the app; a field the deployment has not set is null */
export interface Publisher {
  name: string | null; // First name and surname, as the person responsible for the data
  email: string | null; // Where questions and requests reach them
}
