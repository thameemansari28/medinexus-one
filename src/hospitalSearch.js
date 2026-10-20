const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

function readAddress(tags) {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  return [tags["addr:full"] || street, tags["addr:suburb"] || tags["addr:district"], tags["addr:city"] || tags["addr:town"] || tags["addr:village"], tags["addr:postcode"]]
    .filter(Boolean)
    .join(", ");
}

export async function findNearbyHospitals(latitude, longitude, { signal, radiusMeters = 10000 } = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("A valid location is required to search nearby facilities.");
  const query = `[out:json][timeout:15];(nwr(around:${radiusMeters},${lat},${lon})["amenity"~"^(hospital|clinic)$"]["name"];nwr(around:${radiusMeters},${lat},${lon})["healthcare"~"^(hospital|clinic)$"]["name"];);out center tags 60;`;
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!response.ok) throw new Error(`Nearby facility search returned HTTP ${response.status}.`);
  const payload = await response.json();
  const seen = new Set();
  return (payload.elements || []).flatMap((element) => {
    const tags = element.tags || {};
    const point = element.center || element;
    const latValue = Number(point.lat);
    const lonValue = Number(point.lon);
    const name = tags.name || tags["name:en"];
    if (!name || !Number.isFinite(latValue) || !Number.isFinite(lonValue)) return [];
    const key = `${name.toLowerCase()}|${latValue.toFixed(5)}|${lonValue.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `osm-${element.type}-${element.id}`,
      name,
      type: tags.amenity || tags.healthcare || "healthcare facility",
      address: readAddress(tags),
      city: tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "",
      state: tags["addr:state"] || "",
      phone: tags.phone || tags["contact:phone"] || "",
      website: tags.website || tags["contact:website"] || "",
      latitude: latValue,
      longitude: lonValue,
      specialties: [],
      services: [],
      directorySource: "openstreetmap",
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    }];
  });
}
