export const WORK_SITES = [
  { id: 'site_hyd', name: 'Hyderabad HQ (HiTech)', latitude: 17.4532, longitude: 78.3821, radius: 200 },
  { id: 'site_noida', name: 'Noida Highway Site', latitude: 28.5355, longitude: 77.3910, radius: 300 },
  { id: 'site_blr', name: 'Bengaluru Office', latitude: 12.9716, longitude: 77.5946, radius: 150 },
  { id: 'site_delhi', name: 'Delhi Metro Construction', latitude: 28.6139, longitude: 77.2090, radius: 250 },
];

/**
 * Calculates distance between two GPS coordinates in meters using the Haversine formula.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};
