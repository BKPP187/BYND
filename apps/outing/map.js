// WGS84 map backed by OpenFreeMap, whose public service supports websites and apps.
// Never use the restricted OSM Standard tile server or display remote error images.
const OUTING_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const OUTING_NEARBY_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let outingMap = null;
let outingMapLayers = null;
let outingBasemapLayer = null;
let outingBasemapTimer = null;
let outingMapFailed = false;
let outingMapPointKey = '';
let outingNearbyJob = null;
let outingNearbyController = null;
let outingNearbyError = '';
let outingNearbySyncError = '';
let outingNearbyLoading = false;
let outingNearbyCategory = 'all';
let outingMapLoad = null;

function isOutingPoint(point) {
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
        && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

function loadOutingMapAsset(path, css = false) {
    return new Promise((resolve, reject) => {
        const element = document.createElement(css ? 'link' : 'script');
        if (css) { element.rel = 'stylesheet'; element.href = path; } else element.src = path;
        const timer = setTimeout(() => { element.remove(); reject(new Error('地图组件加载超时，请重试。')); }, 12000);
        element.onload = () => { clearTimeout(timer); resolve(); };
        element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error('地图组件加载失败，请重试。')); };
        document.head.appendChild(element);
    });
}
async function loadOutingMapLibrary() {
    if (window.L?.maplibreGL && window.maplibregl) return window.L;
    if (!outingMapLoad) outingMapLoad = (async () => {
        // Classic local bundles work in file:// previews and embedded WebViews as well as HTTPS.
        if (!window.L) {
            await loadOutingMapAsset('assets/vendor/leaflet/leaflet.css', true);
            await loadOutingMapAsset('assets/vendor/leaflet/leaflet.js');
        }
        if (!window.maplibregl) {
            await loadOutingMapAsset('assets/vendor/maplibre/maplibre-gl.css', true);
            await loadOutingMapAsset('assets/vendor/maplibre/maplibre-gl.js');
        }
        if (!window.L.maplibreGL) await loadOutingMapAsset('assets/vendor/maplibre/leaflet-maplibre-gl.js');
        return window.L;
    })().catch(error => { outingMapLoad = null; throw error; });
    return outingMapLoad;
}

function setOutingMapFailure(message = '') {
    outingMapFailed = !!message;
    const error = document.getElementById('outing-map-error');
    if (error) error.textContent = message;
    const overlay = document.getElementById('outing-map-unavailable');
    if (overlay) overlay.hidden = !message;
    if (message) { const placeholder = document.getElementById('outing-map-placeholder'); if (placeholder) placeholder.hidden = true; }
}

function mountOutingBasemap(L) {
    if (outingBasemapLayer) return;
    setOutingMapFailure('');
    try {
        const layer = L.maplibreGL({ style: OUTING_MAP_STYLE, padding: 0, attribution: '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(outingMap);
        outingBasemapLayer = layer;
        const gl = layer.getMaplibreMap();
        outingBasemapTimer = setTimeout(() => { if (outingBasemapLayer === layer) setOutingMapFailure('地图连接超时，请检查网络后重试。定位与手账已保留。'); }, 15000);
        gl.on('error', () => {
            if (outingBasemapLayer !== layer) return;
            setOutingMapFailure('地图暂时无法连接，请检查网络后重试。定位与手账已保留。');
        });
        gl.on('idle', () => {
            if (outingBasemapLayer !== layer || !gl.isStyleLoaded() || !gl.getSource('openmaptiles') || !gl.isSourceLoaded('openmaptiles') || !gl.queryRenderedFeatures().length) return;
            clearTimeout(outingBasemapTimer);
            setOutingMapFailure('');
        });
    } catch (_) { setOutingMapFailure('设备暂时无法显示地图，可重试或继续记录手账。'); }
}

function groupOutingMapPlaces(places, project) {
    const groups = [];
    places.forEach((poi, index) => {
        const pixel = project(poi);
        let group = groups.find(g => Math.hypot(g.x - pixel.x, g.y - pixel.y) < 36);
        if (!group) { group = { x: pixel.x, y: pixel.y, lat: poi.lat, lng: poi.lng, places: [] }; groups.push(group); }
        const n = group.places.length;
        group.x = (group.x * n + pixel.x) / (n + 1); group.y = (group.y * n + pixel.y) / (n + 1);
        group.lat = (group.lat * n + poi.lat) / (n + 1); group.lng = (group.lng * n + poi.lng) / (n + 1);
        group.places.push({ ...poi, index });
    });
    return groups;
}
async function retryOutingMap() {
    clearTimeout(outingBasemapTimer);
    if (outingBasemapLayer) { outingMap.removeLayer(outingBasemapLayer); outingBasemapLayer = null; }
    await renderOutingMap();
    loadOutingNearby(true);
}

async function renderOutingMap() {
    const host = document.getElementById('outing-live-map');
    const point = getOutingState().currentPoint;
    if (!host || !isOutingPoint(point)) return;
    try {
        const L = await loadOutingMapLibrary();
        if (!outingMap) {
            outingMap = L.map(host, { zoomControl: false, scrollWheelZoom: false, minZoom: 1, maxZoom: 19, maxBounds: [[-85, -360], [85, 360]], maxBoundsViscosity: 1 }).setView([point.lat, point.lng], 15);
            L.control.zoom({ position: 'bottomleft' }).addTo(outingMap);
            outingMapLayers = L.layerGroup().addTo(outingMap);
            outingMap.on('zoomend', () => renderOutingMap());
        }
        mountOutingBasemap(L);
        document.getElementById('outing-map-placeholder').hidden = true;
        outingMap.invalidateSize();
        const key = `${point.lat},${point.lng}`;
        if (key !== outingMapPointKey) {
            outingMap.setView([point.lat, point.lng], outingMapPointKey ? outingMap.getZoom() : 15);
            outingMapPointKey = key;
        }
        outingMapLayers.clearLayers();
        L.circleMarker([point.lat, point.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#7b84b4', fillOpacity: 1 }).addTo(outingMapLayers).bindTooltip('你在这里');
        const state = getOutingState();
        const track = (state.journey?.points || []).filter(isOutingPoint);
        if (track.length > 1) L.polyline(track.map(p => [p.lat, p.lng]), { color: '#8b91ae', weight: 3, dashArray: '5 8' }).addTo(outingMapLayers);
        const groups = groupOutingMapPlaces(getOutingVisiblePlaces(), poi => outingMap.latLngToLayerPoint([poi.lat, poi.lng]));
        groups.forEach(group => {
            const count = group.places.length, poi = group.places[0];
            const category = group.places.every(p => p.category === 'food') ? 'food' : 'play';
            const icon = L.divIcon({ className: 'outing-map-marker', html: `<span class="is-${category}${count > 1 ? ' is-cluster' : ''}">${count > 1 ? count : poi.index + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
            const popup = document.createElement('div');
            popup.className = 'outing-map-popup-list';
            const title = document.createElement('strong'); title.textContent = count > 1 ? `这里有 ${count} 个地点` : poi.name; popup.append(title);
            group.places.forEach(p => {
                const details = document.createElement('p'); details.textContent = `${count > 1 ? p.name + ' · ' : ''}${p.category === 'food' ? '吃喝' : '玩乐'} · ${Math.round(p.distance)}m`;
                const button = document.createElement('button'); button.textContent = '记下到过这里'; button.onclick = () => openOutingEditor('place', p.name);
                popup.append(details, button);
            });
            L.marker([group.lat, group.lng], { icon }).addTo(outingMapLayers).bindPopup(popup).bindTooltip(count > 1 ? `${count} 个附近地点，点击查看` : poi.name);
        });
    } catch (error) { setOutingMapFailure(error.message); }
}

function getOutingVisiblePlaces() {
    const state = getOutingState();
    if (state.nearby?.point && getOutingDistanceMeters(state.nearby.point, state.currentPoint) >= 500) return [];
    return (state.nearby?.places || []).filter(p => outingNearbyCategory === 'all' || p.category === outingNearbyCategory);
}

function filterOutingNearby(category) {
    outingNearbyCategory = ['food', 'play'].includes(category) ? category : 'all';
    renderOutingNearby(); renderOutingMap();
}

function renderOutingNearby() {
    const host = document.getElementById('outing-nearby-list');
    if (!host) return;
    document.querySelectorAll('[data-outing-category]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.outingCategory === outingNearbyCategory)));
    const places = getOutingVisiblePlaces();
    const state = getOutingState();
    const rows = places.map((p, i) => `<button class="outing-nearby-row" data-place-index="${i}"><span class="outing-number is-${p.category === 'food' ? 'food' : 'play'}">${i + 1}</span><span><strong>${outingEscape(p.name)}</strong><small>${p.category === 'food' ? '吃喝' : '玩乐'} · ${Math.round(p.distance)}m${p.address ? ' · ' + outingEscape(p.address) : ''}</small></span><i class="ri-add-line"></i></button>`).join('');
    host.innerHTML = outingNearbyLoading ? '<p class="outing-empty">正在寻找附近的小店与风景…</p>'
        : outingNearbyError ? `<p class="outing-inline-error" role="alert">${outingEscape(outingNearbyError)}</p><button class="outing-text-btn" onclick="loadOutingNearby(true)">重新查找</button>${places.length ? '<small class="outing-nearby-cached">以下为上次查到的地点</small>' + rows : ''}`
        : places.length ? rows
        : `<p class="outing-empty">${isOutingPoint(state.currentPoint) ? '附近暂未收录地点，可以手动记下喜欢的地方。' : '确认定位后，看看附近有什么。'}</p>`;
    if (outingNearbySyncError) host.insertAdjacentHTML('beforeend', `<p class="outing-inline-error">${outingEscape(outingNearbySyncError)}</p><button class="outing-text-btn" onclick="retryOutingNearbySync()">重试同步给角色</button>`);
    host.querySelectorAll('[data-place-index]').forEach(button => button.onclick = () => openOutingEditor('place', places[Number(button.dataset.placeIndex)].name));
    const stamp = document.getElementById('outing-nearby-time');
    if (stamp) stamp.textContent = state.nearby?.at ? `更新于 ${formatOutingTime(state.nearby.at)}` : '';
    const source = document.getElementById('outing-nearby-source');
    if (source) source.textContent = state.nearby?.source === 'map' ? '当前地图附近 · OpenStreetMap' : '附近数据 · OpenStreetMap';
}

function normalizeOutingPlaces(places, point) {
    const seen = new Set();
    return places.filter(p => {
        if (!isOutingPoint(p) || !p.name || !Number.isFinite(p.distance) || p.distance > 1500) return false;
        const key = `${p.name}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
    }).sort((a, b) => a.distance - b.distance).slice(0, 24);
}

function readOutingVectorPlaces(gl, point) {
    if (!gl?.getSource('openmaptiles') || !gl.isSourceLoaded('openmaptiles')) return null;
    const features = gl.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' });
    const places = features.map(feature => {
        const tags = feature.properties || {}, type = String(tags.subclass || tags.class || '');
        const food = /^(restaurant|cafe|fast_food|bar|pub|biergarten|ice_cream|bakery|food_court)$/.test(type);
        const play = /^(park|garden|playground|cinema|theatre|museum|attraction|viewpoint|gallery|zoo|aquarium|theme_park|arts_centre|books|library)$/.test(type);
        if ((!food && !play) || feature.geometry?.type !== 'Point') return null;
        const [lng, lat] = feature.geometry.coordinates;
        const p = { lat, lng };
        return { ...p, id: `map_${feature.id ?? `${lat}_${lng}`}`, name: String(tags['name:zh'] || tags.name_zh || tags.name || '').slice(0, 80), category: food ? 'food' : 'play', address: '', distance: getOutingDistanceMeters(point, p) };
    }).filter(Boolean);
    return normalizeOutingPlaces(places, point);
}

async function queryOutingVectorPlaces(point) {
    await renderOutingMap();
    const gl = outingBasemapLayer?.getMaplibreMap();
    if (!gl || outingMapFailed) return null;
    return new Promise(resolve => {
        const cleanup = result => { clearTimeout(timer); gl.off('sourcedata', check); gl.off('idle', check); gl.off('error', failed); resolve(result); };
        const check = () => {
            try {
                const places = readOutingVectorPlaces(gl, point);
                if (places !== null) cleanup(places);
            } catch (_) { cleanup(null); }
        };
        const failed = () => cleanup(null);
        const timer = setTimeout(() => cleanup(null), 10000);
        gl.on('sourcedata', check); gl.on('idle', check); gl.on('error', failed); check();
    });
}

async function fetchOutingNearbyElements(point) {
    const query = `[out:json][timeout:7];(nwr(around:1500,${point.lat},${point.lng})[amenity~"^(restaurant|cafe|fast_food|bar|ice_cream|cinema|theatre)$"][name];nwr(around:1500,${point.lat},${point.lng})[leisure~"^(park|garden|playground)$"][name];nwr(around:1500,${point.lat},${point.lng})[tourism~"^(museum|attraction|viewpoint|gallery)$"][name];);out center tags;`;
    let lastError;
    for (const endpoint of OUTING_NEARBY_ENDPOINTS) {
        const controller = new AbortController(); outingNearbyController = controller;
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal: controller.signal });
            if (!response.ok) throw new Error(`附近查询暂不可用（${response.status}），请稍后重试。`);
            const data = await response.json();
            if (!Array.isArray(data.elements) || data.remark) throw new Error('附近查询未完成，请重试。');
            return data.elements;
        } catch (error) { lastError = error; } finally { clearTimeout(timer); }
    }
    if (lastError?.name === 'AbortError') throw new Error('附近查询超时，请检查网络后重试。');
    if (lastError?.name === 'SyntaxError') throw new Error('附近地点服务返回异常，请稍后重试。');
    if (lastError instanceof TypeError || /failed to fetch|network|load failed/i.test(lastError?.message || '')) throw new Error('附近地点服务连接失败，请检查网络后重试；也可以手动记下去过的地方。');
    throw lastError || new Error('附近地点暂不可用，请稍后重试。');
}

async function retryOutingNearbySync() {
    try {
        const state = getOutingState();
        await syncOutingNearbyToChar(state.journey?.id || ''); outingNearbySyncError = '';
    } catch (error) { outingNearbySyncError = `地点已保存，但尚未同步给角色：${error.message}`; }
    renderOutingNearby();
}

async function loadOutingNearby(force = false) {
    const state = getOutingState(), point = state.currentPoint;
    if (!isOutingPoint(point)) return;
    if (outingNearbyJob) return outingNearbyJob;
    if (!force && state.nearby?.point && Date.now() - state.nearby.at < 10 * 60 * 1000 && getOutingDistanceMeters(state.nearby.point, point) < 500) return;
    outingNearbyLoading = true; outingNearbyError = ''; outingNearbySyncError = ''; renderOutingNearby();
    outingNearbyJob = (async () => {
        try {
            const mapPlaces = await queryOutingVectorPlaces(point);
            let source = 'map', places = mapPlaces;
            if (!places?.length) {
                source = 'query';
                try {
                    const elements = await fetchOutingNearbyElements(point);
                    places = normalizeOutingPlaces(elements.map(el => {
                const p = { lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon };
                return { ...p, id: `${el.type}/${el.id}`, name: String(el.tags?.['name:zh'] || el.tags?.name || '').slice(0, 80), category: /^(restaurant|cafe|fast_food|bar|ice_cream)$/.test(el.tags?.amenity) ? 'food' : 'play', address: String(el.tags?.['addr:street'] || '').slice(0, 100), distance: getOutingDistanceMeters(point, p) };
                    }), point);
                } catch (error) {
                    // The map may have finished loading while the two query services failed.
                    const latePlaces = readOutingVectorPlaces(outingBasemapLayer?.getMaplibreMap(), point);
                    if (!latePlaces?.length) throw error;
                    places = latePlaces; source = 'map';
                }
            }
            const fresh = getOutingState();
            // Discard replies for a location the user has already left.
            if (getOutingDistanceMeters(point, fresh.currentPoint) >= 500) return;
            fresh.nearby = { places, point, source, at: Date.now() }; saveOutingState(fresh);
            // Query success and delivery success are different states. A failed chat save
            // must not hide real places or advertise successful synchronization.
            await retryOutingNearbySync();
        } catch (error) { outingNearbyError = error.name === 'AbortError' ? '附近查询超时，请重试。' : error.message; }
        finally { outingNearbyJob = null; outingNearbyLoading = false; renderOutingNearby(); renderOutingMap(); }
    })();
    return outingNearbyJob;
}
