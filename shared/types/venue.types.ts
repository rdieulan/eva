// Venue types

/**
 * Public venue data (visible by all authenticated users)
 */
export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
}
