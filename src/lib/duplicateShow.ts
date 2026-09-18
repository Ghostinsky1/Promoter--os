import { supabase } from './supabase';

/**
 * PROMOTER OS — is this show already in here?
 *
 * Nothing used to ask. The New Offer form, the Duplicate button and the Claude
 * connector each wrote a fresh show row stamped with the clock, so the same
 * night could go in twice and nothing noticed until the month's profit was
 * $2,206 too high. The database now refuses an exact repeat; this is the
 * friendlier check that runs first, so the promoter is told what exists and
 * offered the link instead of hitting an error.
 */

export interface ExistingShow {
  offerId: string;
  showId: string;
  artistName: string;
  venueName: string;
  eventDate: string;
  status: string;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

export async function findExistingShow(
  organizationId: string,
  artistName: string,
  venueName: string,
  eventDate: string,
): Promise<ExistingShow | null> {
  if (!artistName || !venueName || !eventDate) return null;

  const { data, error } = await supabase
    .from('shows')
    .select('id, artist_name, venue_name, event_date, offers(id, status)')
    .eq('organization_id', organizationId)
    .eq('event_date', eventDate);
  if (error || !data) return null;

  for (const s of data as any[]) {
    if (norm(s.artist_name) !== norm(artistName)) continue;
    if (norm(s.venue_name) !== norm(venueName)) continue;
    const offer = Array.isArray(s.offers) ? s.offers[0] : s.offers;
    return {
      offerId: offer?.id ?? '',
      showId: s.id,
      artistName: s.artist_name,
      venueName: s.venue_name,
      eventDate: s.event_date,
      status: offer?.status ?? 'unknown',
    };
  }
  return null;
}

/** The Postgres unique-violation code, so the caller can say the right thing. */
export function isDuplicateShowError(err: any): boolean {
  return err?.code === '23505' && String(err?.message || '').includes('shows_one_per_artist_venue_night');
}
