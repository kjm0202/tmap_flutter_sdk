// Re-record REST response fixtures using the locally configured test AppKey.
// The key is sent only as an HTTP header and never written to a fixture.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureDir = join(projectRoot, 'test', 'fixtures', 'tdata');
const appKey = JSON.parse(readFileSync(
  join(homedir(), '.config/tmap_flutter_sdk/test-app-key.json'), 'utf8',
)).TMAP_APP_KEY;
if (typeof appKey !== 'string' || !appKey) {
  throw new Error('Local TMAP test key is unavailable');
}

const baseUrl = 'https://apis.openapi.sk.com';
const commonQuery = {version: '1', format: 'json'};

function stripCredentials(value) {
  if (Array.isArray(value)) return value.map(stripCredentials);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([k]) => !/^(appkey|apikey|access_token|token)$/i.test(k))
      .map(([k, v]) => [k, stripCredentials(v)]));
  }
  if (typeof value === 'string') return value.replaceAll(appKey, '[REDACTED]');
  return value;
}

async function capture(filename, path, query = {}, postBody) {
  const url = new URL(path, baseUrl);
  Object.entries({...commonQuery, ...query}).forEach(([k, v]) => {
    url.searchParams.set(k, String(v));
  });
  const response = await fetch(url, {
    method: postBody ? 'POST' : 'GET',
    headers: {
      appKey,
      Accept: 'application/json',
      ...(postBody ? {'Content-Type': 'application/json'} : {}),
    },
    body: postBody ? JSON.stringify(postBody) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`${filename}: HTTP ${response.status}`);
  }
  const body = await response.json();
  if (!body || typeof body !== 'object' || body.error != null) {
    throw new Error(`${filename}: unexpected response shape`);
  }
  // Traffic responses contain hundreds of roads. Preserve a few complete,
  // unmodified real features, including one nonzero congestion value.
  const sample = filename === 'traffic.json' && Array.isArray(body.features)
    ? {
        ...body,
        features: [
          ...body.features.slice(0, 2),
          ...body.features.filter((item) =>
            Number(item.properties?.congestion) > 0).slice(0, 1),
        ],
      }
    : body;
  const json = JSON.stringify(stripCredentials(sample), null, 2) + '\n';
  if (json.includes(appKey)) throw new Error('Credential found in fixture');
  writeFileSync(join(fixtureDir, filename), json, {flag: 'w'});
  console.log(`${filename}: HTTP ${response.status}; ${json.length} bytes`);
  return body;
}

mkdirSync(fixtureDir, {recursive: true});
const cityHall = {latitude: 37.5665, longitude: 126.978};
const station = {latitude: 37.5547, longitude: 126.9706};
const routeRequest = {
  startX: cityHall.longitude, startY: cityHall.latitude,
  endX: station.longitude, endY: station.latitude,
  reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
};
await capture('route.json', '/tmap/routes', {}, {
  ...routeRequest, searchOption: 0,
});
await capture('pedestrian.json', '/tmap/routes/pedestrian', {}, {
  ...routeRequest, startName: '서울시청', endName: '서울역',
});
const pois = await capture('pois.json', '/tmap/pois', {
  searchKeyword: '서울시청', count: 2, page: 1,
  reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
});
await capture('around.json', '/tmap/pois/search/around', {
  centerLat: cityHall.latitude, centerLon: cityHall.longitude,
  count: 2, page: 1, radius: 1, categories: '편의점',
  reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
});
await capture('full_addr_geo.json', '/tmap/geo/fullAddrGeo', {
  fullAddr: '서울특별시 중구 세종대로 110', addressFlag: 'F00',
  coordType: 'WGS84GEO',
});
await capture('reverse_geo.json', '/tmap/geo/reversegeocoding', {
  lat: cityHall.latitude, lon: cityHall.longitude,
  coordType: 'WGS84GEO', addressType: 'A04',
});
await capture('autocomplete.json', '/tmap/poi/autoComplete', {
  searchKeyword: '서울역',
});
await capture('autocomplete_v2.json', '/tmap/poi/V2autoComplete', {
  searchKeyword: '서울역', centerLat: station.latitude,
  centerLon: station.longitude, radius: 5, numResults: 3,
});
await capture('traffic.json', '/tmap/traffic', {
  minLat: 37.56, minLon: 126.97, maxLat: 37.575, maxLon: 126.99,
  zoomLevel: 14, reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
});
const poiId = pois.searchPoiInfo?.pois?.poi?.[0]?.id;
if (typeof poiId !== 'string' || !poiId) {
  throw new Error('POI search did not yield a detail ID');
}
await capture('poi_detail.json', `/tmap/pois/${encodeURIComponent(poiId)}`, {
  resCoordType: 'WGS84GEO',
});
await capture('geocoding.json', '/tmap/geo/geocoding', {
  city_do: '서울', gu_gun: '중구', dong: '태평로1가', bunji: '31',
  coordType: 'WGS84GEO',
});
await capture('coordconvert.json', '/tmap/geo/coordconvert', {
  lat: cityHall.latitude, lon: cityHall.longitude,
  fromCoord: 'WGS84GEO', toCoord: 'EPSG3857',
});
