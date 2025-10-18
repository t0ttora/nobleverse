type SeaFetchInput = {
  identifier: string | null; // container or BL or MMSI/IMO
  provider?: string | null;
  meta?: any;
};

export type Position = {
  lat: number;
  lon: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  provider?: string | null;
};

export async function fetchSeaPosition(
  input: SeaFetchInput
): Promise<Position> {
  const provider = (
    input.provider ||
    process.env.NEXT_PUBLIC_SEA_PROVIDER ||
    ''
  ).toLowerCase();
  const id = input.identifier || '';

  if (provider === 'marinetraffic') {
    const key = process.env.MARINETRAFFIC_API_KEY;
    if (!key) throw new Error('MarineTraffic API key missing');
    throw new Error(
      'MarineTraffic fetch not wired: provide MMSI/IMO mapping and enable outbound'
    );
  }
  if (provider === 'ais') {
    const key = process.env.AIS_API_KEY;
    if (!key) throw new Error('AIS API key missing');
    throw new Error(
      'AIS fetch not wired: provide vessel mapping and enable outbound'
    );
  }

  throw new Error('Sea provider not configured');
}
