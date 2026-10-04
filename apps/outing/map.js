// Real WGS84 map and nearby places. No synthetic POIs or offline tile downloads.
let outingMap = null;
let outingMapLayers = null;
let outingMapPointKey = '';
let outingNearbyJob = null;
let outingNearbyController = null;
let outingNearbyError = '';
let outingNearbyLoading = false;
let outingNearbyCategory = 'all';
let outingMapLoad = null;

function isOutingPoint(point) {
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
        && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

async function loadOutingMapLibrary() {
    if (window.L) return window.L;
    if (!outingMapLoad) outingMapLoad = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = 'assets/vendor/leaflet/leaflet.css';
        document.head.appendChild(css);
        const script = document.createElement('script');
        script.src = 'assets/vendor/leaflet/leaflet.js';
        script.onload = () => resolve(window.L);
        script.onerror = () => { script.remove(); css.remove(); outingMapLoad = null; reject(new Error('地图组件加载失败，请重试')); };
        document.head.appendChild(script);
    });
    return outingMapLoad;
}

async function renderOutingMap() {
    const host = document.getElementById('outing-live-map');
    const point = getOutingState().currentPoint;
    if (!host || !isOutingPoint(point)) return;
    try {
        const L = await loadOutingMapLibrary();
        if (!outingMap) {
            outingMap = L.map(host, { zoomControl: false, scrollWheelZoom: false, maxZoom: 19 });
            L.control.zoom({ position: 'bottomleft' }).addTo(outingMap);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
                referrerPolicy: 'strict-origin-when-cross-origin'
            }).on('tileerror', () => {
                document.getElementById('outing-map-error').textContent = '底图加载失败，可重试定位；附近列表和手账仍可使用。';
            }).on('tileload', () => { document.getElementById('outing-map-error').textContent = ''; }).addTo(outingMap);
            outingMapLayers = L.layerGroup().addTo(outingMap);
        }
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
        getOutingVisiblePlaces().forEach((poi, index) => {
            const icon = L.divIcon({ className: 'outing-map-marker', html: `<span class="is-${poi.category === 'food' ? 'food' : 'play'}">${index + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
            const popup = document.createElement('div');
            const title = document.createElement('strong'); title.textContent = poi.name;
            const details = document.createElement('p'); details.textContent = `${poi.category === 'food' ? '吃喝' : '玩乐'} · ${Math.round(poi.distance)}m`;
            const button = document.createElement('button'); button.textContent = '记下到过这里'; button.onclick = () => openOutingEditor('place', poi.name);
            popup.append(title, details, button);
            L.marker([poi.lat, poi.lng], { icon }).addTo(outingMapLayers).bindPopup(popup);
        });
    } catch (error) { document.getElementById('outing-map-error').textContent = error.message; }
}

function getOutingVisiblePlaces() {
    return (getOutingState().nearby?.places || []).filter(p => outingNearbyCategory === 'all' || p.category === outingNearbyCategory);
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
    host.innerHTML = outingNearbyLoading ? '<p class="outing-empty">正在寻找附近的小店与风景…</p>'
        : outingNearbyError ? `<p class="outing-inline-error" role="alert">${outingEscape(outingNearbyError)}</p><button class="outing-text-btn" onclick="loadOutingNearby(true)">重新查找</button>`
        : places.length ? places.map((p, i) => `<button class="outing-nearby-row" data-place-index="${i}"><span class="outing-number is-${p.category}">${i + 1}</span><span><strong>${outingEscape(p.name)}</strong><small>${p.category === 'food' ? '吃喝' : '玩乐'} · ${Math.round(p.distance)}m${p.address ? ' · ' + outingEscape(p.address) : ''}</small></span><i class="ri-add-line"></i></button>`).join('')
        : `<p class="outing-empty">${isOutingPoint(state.currentPoint) ? '附近暂未收录地点，可以手动记下喜欢的地方。' : '确认定位后，看看附近有什么。'}</p>`;
    host.querySelectorAll('[data-place-index]').forEach(button => button.onclick = () => openOutingEditor('place', places[Number(button.dataset.placeIndex)].name));
    const stamp = document.getElementById('outing-nearby-time');
    if (stamp) stamp.textContent = state.nearby?.at ? `更新于 ${formatOutingTime(state.nearby.at)}` : '';
}

async function loadOutingNearby(force = false) {
    const state = getOutingState(), point = state.currentPoint;
    if (!isOutingPoint(point)) return;
    if (outingNearbyJob) return outingNearbyJob;
    if (!force && state.nearby?.point && Date.now() - state.nearby.at < 10 * 60 * 1000 && getOutingDistanceMeters(state.nearby.point, point) < 500) return;
    outingNearbyController = new AbortController();
    const timer = setTimeout(() => outingNearbyController?.abort(), 25000);
    outingNearbyLoading = true; outingNearbyError = ''; renderOutingNearby();
    outingNearbyJob = (async () => {
        try {
            const query = `[out:json][timeout:20];(nwr(around:1500,${point.lat},${point.lng})[amenity~"^(restaurant|cafe|fast_food|bar|ice_cream|cinema|theatre)$"][name];nwr(around:1500,${point.lat},${point.lng})[leisure~"^(park|garden|playground)$"][name];nwr(around:1500,${point.lat},${point.lng})[tourism~"^(museum|attraction|viewpoint|gallery)$"][name];);out center tags;`;
            const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }), signal: outingNearbyController.signal });
            if (!response.ok) throw new Error(`附近查询暂不可用（${response.status}）`);
            const data = await response.json();
            if (!Array.isArray(data.elements) || data.remark) throw new Error('附近查询未完成，请重试');
            const seen = new Set();
            const places = data.elements.map(el => {
                const p = { lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon };
                return { ...p, id: `${el.type}/${el.id}`, name: String(el.tags?.['name:zh'] || el.tags?.name || '').slice(0, 80), category: /^(restaurant|cafe|fast_food|bar|ice_cream)$/.test(el.tags?.amenity) ? 'food' : 'play', address: String(el.tags?.['addr:street'] || '').slice(0, 100), distance: getOutingDistanceMeters(point, p) };
            }).filter(p => {
                const key = `${p.name}|${p.lat}|${p.lng}`;
                if (!isOutingPoint(p) || !p.name || seen.has(key)) return false;
                seen.add(key); return true;
            }).sort((a, b) => a.distance - b.distance).slice(0, 24);
            const fresh = getOutingState();
            // Discard replies for a location the user has already left.
            if (getOutingDistanceMeters(point, fresh.currentPoint) >= 500) return;
            fresh.nearby = { places, point, at: Date.now() }; saveOutingState(fresh);
            await syncOutingNearbyToChar(fresh.journey?.id || '');
        } catch (error) { outingNearbyError = error.name === 'AbortError' ? '附近查询超时，请重试。' : error.message; }
        finally { clearTimeout(timer); outingNearbyJob = null; outingNearbyLoading = false; renderOutingNearby(); renderOutingMap(); }
    })();
    return outingNearbyJob;
}
