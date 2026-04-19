/**
 * OpenStreetMap Nominatim (no API key). Respect usage policy: throttle + User-Agent.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const USER_AGENT = 'PharmaTrace/1.0 (pharmaceutical supply-chain verification)';

let lastNominatimCallAt = 0;
const MIN_INTERVAL_MS = 1100;

async function nominatimThrottle() {
    const now = Date.now();
    const wait = lastNominatimCallAt + MIN_INTERVAL_MS - now;
    if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
    }
    lastNominatimCallAt = Date.now();
}

function pickCityFromAddress(addr) {
    if (!addr || typeof addr !== 'object') return null;
    return (
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.state_district ||
        addr.county ||
        null
    );
}

const forwardCityCache = new Map();

/**
 * @returns {Promise<string|null>}
 */
async function reverseGeocodeToCity(lat, lon) {
    try {
        const la = Number(lat);
        const lo = Number(lon);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
        await nominatimThrottle();
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(la)}&lon=${encodeURIComponent(lo)}&format=json`;
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return null;
        const data = await res.json();
        return pickCityFromAddress(data.address) || null;
    } catch {
        return null;
    }
}

/**
 * @returns {Promise<{ lat: number, lon: number } | null>}
 */
async function forwardGeocodeCity(cityName) {
    try {
        const q = String(cityName).trim();
        if (!q) return null;
        await nominatimThrottle();
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return null;
        const arr = await res.json();
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const hit = arr[0];
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { lat, lon };
    } catch {
        return null;
    }
}

/**
 * In-memory cache to limit Nominatim calls for the same city string.
 * @returns {Promise<{ lat: number, lon: number } | null>}
 */
async function forwardGeocodeCityCached(cityName) {
    const key = String(cityName).trim().toLowerCase();
    if (!key) return null;
    if (forwardCityCache.has(key)) {
        return forwardCityCache.get(key);
    }
    const coords = await forwardGeocodeCity(cityName);
    forwardCityCache.set(key, coords);
    return coords;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = {
    reverseGeocodeToCity,
    forwardGeocodeCity,
    forwardGeocodeCityCached,
    haversineDistanceKm
};
