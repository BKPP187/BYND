# Outing vector map runtime

- `maplibre-gl.js`, `maplibre-gl.css`: MapLibre GL JS **5.7.3**, official npm distribution, BSD-3-Clause (`LICENSE-maplibre.txt`).
- `leaflet-maplibre-gl.js`: `@maplibre/maplibre-gl-leaflet` **0.1.1**, official npm distribution, ISC (`LICENSE-binding.txt`). This version supports the classic browser globals and MapLibre 5.

The bundles load locally, including in file previews and Android WebViews. Basemap style, vector tiles, sprites and glyphs come from OpenFreeMap's public instance. This is a separate provider from the restricted OSM Standard raster tile server. Attribution for OpenFreeMap, OpenMapTiles and OpenStreetMap stays visible.

Nearby POIs first come from the actually loaded `openmaptiles` source (`poi` layer), restricted to named eat/drink/leisure places within 1.5 km. This covers the loaded map area rather than claiming exhaustive circle coverage. The two Overpass endpoints are secondary queries. Never proxy, spoof identification or retry the blocked OSM Standard service.

References: [OpenFreeMap integration and mobile apps](https://openfreemap.org/quick_start/), [public instance terms](https://openfreemap.org/), [MapLibre source feature queries](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#querysourcefeatures), [Leaflet binding](https://github.com/maplibre/maplibre-gl-leaflet).
