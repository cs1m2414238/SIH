// Standard NMEA 0183 Sentence Generator for Rover Position and Satellite Telemetry

function calculateNmeaChecksum(sentence) {
  let checksum = 0;
  for (let i = 0; i < sentence.length; i++) {
    checksum ^= sentence.charCodeAt(i);
  }
  return checksum.toString(16).toUpperCase().padStart(2, '0');
}

function formatNmeaCoord(deg, isLat) {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * 60.0;
  const degStr = isLat
    ? degrees.toString().padStart(2, '0')
    : degrees.toString().padStart(3, '0');
  const minStr = minutes.toFixed(4).padStart(7, '0');
  return `${degStr}${minStr}`;
}

export function generateGNGGA(pos, fixQuality = 1, numSats = 18, hdop = 0.8) {
  const now = new Date();
  const timeStr =
    now.getUTCHours().toString().padStart(2, '0') +
    now.getUTCMinutes().toString().padStart(2, '0') +
    now.getUTCSeconds().toString().padStart(2, '0') +
    '.00';

  const latStr = formatNmeaCoord(pos.latitude, true);
  const latDir = pos.latitude >= 0 ? 'N' : 'S';
  const lonStr = formatNmeaCoord(pos.longitude, false);
  const lonDir = pos.longitude >= 0 ? 'E' : 'W';
  const altStr = pos.altitude.toFixed(1);

  const payload = `GNGGA,${timeStr},${latStr},${latDir},${lonStr},${lonDir},${fixQuality},${numSats},${hdop},${altStr},M,-38.2,M,1.0,0000`;
  const checksum = calculateNmeaChecksum(payload);
  return `$${payload}*${checksum}`;
}

export function generateGNRMC(pos) {
  const now = new Date();
  const timeStr =
    now.getUTCHours().toString().padStart(2, '0') +
    now.getUTCMinutes().toString().padStart(2, '0') +
    now.getUTCSeconds().toString().padStart(2, '0') +
    '.00';

  const latStr = formatNmeaCoord(pos.latitude, true);
  const latDir = pos.latitude >= 0 ? 'N' : 'S';
  const lonStr = formatNmeaCoord(pos.longitude, false);
  const lonDir = pos.longitude >= 0 ? 'E' : 'W';

  const speedKnots = (pos.speed * 1.94384).toFixed(2);
  const headingStr = pos.heading.toFixed(1);

  const dateStr =
    now.getUTCDate().toString().padStart(2, '0') +
    (now.getUTCMonth() + 1).toString().padStart(2, '0') +
    now.getUTCFullYear().toString().slice(-2);

  const payload = `GNRMC,${timeStr},A,${latStr},${latDir},${lonStr},${lonDir},${speedKnots},${headingStr},${dateStr},,,A`;
  const checksum = calculateNmeaChecksum(payload);
  return `$${payload}*${checksum}`;
}
