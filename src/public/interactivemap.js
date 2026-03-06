/* global google */

const flashDelay = 500;
const polyFillOpacity = 0.3;
const polyBorderWidth = 0.0; // no border

const categories = {
    sport: { color: "#ffcc00", legend: "Sportplätze", opacity: polyFillOpacity },
    infra: { color: "#2196f3", legend: "Infrastruktur", opacity: polyFillOpacity },
    places: { color: "#4caf50", legend: "Stellplätze", opacity: 0.0 },
};

const labelStyle = { text: "", color: "#ffffff", fontSize: "14px", fontWeight: "bold", className: "hover-label-style" };
const iconStyle = { path: 0, scale: 0 }; // path: 0 == google.maps.SymbolPath.CIRCLE; scale: 0 == invisible icon

let map;
let bounds;
let mobile = false;
let areasSearch = [];

function drawCMSContent(areasCMS) {

    class TooltipOverlay extends google.maps.OverlayView {
        constructor(position, name, descr, images, url) {
            super();
            this.position = position;
            this.name = name;
            this.descr = descr;
            this.images = images;
            this.url = url;
            this.div = null;
        }

        onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.background = 'rgba(255, 255, 255, 0.9)';
            this.div.style.border = '1px solid #999';
            this.div.style.borderRadius = '8px';
            this.div.style.padding = '12px';
            this.div.style.fontSize = '14px';
            this.div.style.color = '#333';
            this.div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            this.div.style.pointerEvents = 'auto';
            this.div.style.maxWidth = '220px';
            this.div.style.lineHeight = '1.4';
            this.div.style.zIndex = '1000';

            // X-Button zum Schließen
            let content = `<div id="close-tooltip" style="position:absolute; top:5px; right:10px; cursor:pointer; font-weight:bold; font-size:18px; color:#999;">×</div>`;

            content += `<div style="margin-right:15px;"><strong>${this.name}</strong><br><span style="font-size:13px; color:#666;">${this.descr}</span></div>`;

            for (const image of this.images)
                content += `<img src="${image}" style="width:100%; height:auto; margin-top:8px; border-radius:4px; display:block;">`;

            if (this.url)
                content += `<button id="tooltip-btn" style="margin-top:10px; width:100%; padding:6px; cursor:pointer; background:#2196f3; color:white; border:none; border-radius:4px;">Details</button>`;

            this.div.innerHTML = content;

            this.div.querySelector('#close-tooltip').onclick = () => this.setMap(null);
            if (this.url) this.div.querySelector('#tooltip-btn').onclick = (e) => {
                e.stopPropagation();
                window.open(`https://webmaster98234.wixstudio.com/fsg-a/sport/${this.url}`, "_blank");
            };

            const stopEvents = (e) => {
                e.stopPropagation();
                // Bei Touch-Geräten verhindert das oft das "Geister-Klicken"
                if (e.type === 'touchstart') {
                    // e.preventDefault(); // Nur aktivieren, wenn Button-Klicks gar nicht gehen
                }
            };

            this.div.addEventListener('click', stopEvents);
            this.div.addEventListener('touchstart', stopEvents, { passive: true });
            this.div.addEventListener('pointerdown', stopEvents);
            this.div.addEventListener('mousedown', stopEvents);
            this.div.addEventListener('dblclick', stopEvents);

            this.getPanes().overlayMouseTarget.appendChild(this.div);
        }

        draw() {
            if (!this.div) return;
            const pos = this.getProjection().fromLatLngToDivPixel(this.position);
            this.div.style.left = `${pos.x}px`;
            this.div.style.top = `${pos.y - 30}px`;
            this.div.style.transform = 'translateX(-50%)';
        }

        onRemove() {
            this.div?.remove();
            this.div = null;
        }
    }

    let activeTooltip = null; // Globale Referenz, um immer nur einen Tooltip offen zu haben
    let hoverLabel = null;
    let staticMarkers = [];

    function getWixUrl(wixUrl) {
        return wixUrl?.startsWith('wix:image://') ? `https://static.wixstatic.com/media/${wixUrl.split('/')[3]}` : wixUrl;
    }

    function drawPoly(map, bounds, category, title, description, url, paths, images = null) {

        const poly = new google.maps.Polygon({
            paths: paths,
            map,
            fillColor: categories[category].color,
            fillOpacity: categories[category].opacity,
            strokeWeight: polyBorderWidth,
            cursor: "pointer"
        });

        poly.addListener("mouseover", (e) => {
            poly.setOptions({ fillOpacity: 0.7 });
            if (title && category == "places") {
                hoverLabel.setLabel({ ...hoverLabel.getLabel(), text: title });
                hoverLabel.setPosition(e.latLng);
                hoverLabel.setVisible(true);
            }
        });

        poly.addListener("mousemove", (e) => {
            hoverLabel.setPosition(e.latLng);
        });

        poly.addListener("mouseout", () => {
            poly.setOptions({ fillOpacity: categories[category].opacity });
            hoverLabel.setVisible(false);
        });

        poly.addListener("click", (e) => {
            activeTooltip?.setMap(null);
            activeTooltip = new TooltipOverlay(e.latLng, title, description, images?.map(img => getWixUrl(img.src || img)) ?? [], url);
            activeTooltip.setMap(map);
        });

        map.addListener("click", () => {
            activeTooltip?.setMap(null);
            activeTooltip = null;
        });

        const polyBounds = new google.maps.LatLngBounds();
        paths.forEach(p => polyBounds.extend(p));
        if (title && category != "places")
            staticMarkers.push(new google.maps.Marker({ position: polyBounds.getCenter(), icon: iconStyle, label: { ...labelStyle, text: title }, clickable: false, optimized: true }));

        paths.forEach(p => bounds.extend(p));

        areasSearch.push({
            title: String(title ?? "").toLowerCase(),
            isNumber: !isNaN(parseInt(title)),
            description: String(description ?? "").toLowerCase(),
            category,
            poly
        });
    }

    function createLegend() {
        const legend = document.getElementById("legend");
        for (const category of Object.values(categories)) {
            const item = document.createElement("div");
            item.innerHTML = `
              <span style="display:inline-block; width:14px; height:14px; background:${category.color}; margin-right:8px; vertical-align:middle; border:1px solid #ccc;"></span>
              ${capitalize(category.legend)}
            `;
            legend.appendChild(item);
        }
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function startSearch(map) {
        let bounds = null;
        let s = document.getElementById("search").value.trim().toLowerCase();
        ["nr ", "platz ", "place "].forEach(p => { if (s.startsWith(p)) s = s.substring(p.length).trim(); });
        if (s) areasSearch.forEach(area => {
            const match = (area.isNumber ? area.title.startsWith(s) && (area.title.length == s.length || isNaN(area.title[s.length])) : area.title.includes(s)) || area.description.includes(s);
            if (match) {
                const org = categories[area.category].opacity;
                for (let i = 0; i < 6; i++) setTimeout(() => { area.poly.setOptions({ fillOpacity: i % 2 == 0 ? 1 : org }) }, flashDelay * i);
                if (!bounds) bounds = new google.maps.LatLngBounds();
                area.poly.getPath().forEach(latlng => bounds.extend(latlng));
            }
        });
        if (bounds) map.fitBounds(bounds);
    }

    // actual start of drawCMSContent
    /////////////////////////////////

    console.log("drawCMSContent", areasCMS.length, "areas from CMS");
    areasSearch = [];

    mobile = window.innerWidth <= 768;
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: mobile ? 17 : 18,
        center: mobile ? { lat: 48.832, lng: 9.77395 } : { lat: 48.8357, lng: 9.768 },
        mapTypeId: "satellite",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    bounds = new google.maps.LatLngBounds();

    hoverLabel = new google.maps.Marker({ map: map, visible: false, icon: iconStyle, label: labelStyle, clickable: false });

    const defWidthLat = 9.0 / 111320; // width of the stripe in case of latitude: 9m
    const defWidthLng = 9.0 / (111320 * Math.cos(48.84 * Math.PI / 180)); // width of the stripe in case of longitude: 9m at ~49°

    // placeNumber can be a sequence like 1,2,3,4 or 1..4 or combinations like 1a,1b,2..10
    areasCMS.forEach(area => {
        area.placeSequence = [];
        if (area.placeNumber) {
            String(area.placeNumber).split(",").forEach(place => {
                if (place.includes("..")) {
                    const [start, end] = place.split("..");
                    const startNum = Number(start.trim());
                    const endNum = Number(end.trim());
                    if (isNaN(startNum) || isNaN(endNum) || startNum > endNum)
                        area.placeSequence.push(place.trim());
                    else
                        for (let i = startNum; i <= endNum; ++i) area.placeSequence.push(String(i));
                } else if (place.trim().length > 0)
                    area.placeSequence.push(place.trim());
            });
        }
    });

    // areas with single place number and without any path are overrides
    const areaOverrides = areasCMS.filter(a => a.placeSequence.length == 1 && (!a.path || a.path.length == 0));

    areasCMS.forEach(area => {
        if (area.path && area.placeSequence.length > 0 && area.path && area.path.length == 2) {
            const lat0 = area.path[0].lat;
            const lng0 = area.path[0].lng;
            const latN = area.path[1].lat;
            const lngN = area.path[1].lng;
            const realCount = area.placeSequence.length;
            const cntBetween = realCount - 1;
            const latDiff = latN - lat0;
            const lngDiff = lngN - lng0;
            // check in which direction we want to distribute our places (in none, if we only have one)
            const distributeLng = lngDiff > latDiff && cntBetween > 0;
            const distributeLat = lngDiff < latDiff && cntBetween > 0;
            area.placeSequence.forEach((currentName, i) => {
                const haveOverride = areaOverrides.find(a => a.placeSequence[0] == currentName);
                const base = haveOverride ?? area;
                const latC = cntBetween == 0 ? lat0 : lat0 + latDiff / cntBetween * i;
                const lngC = cntBetween == 0 ? lng0 : lng0 + lngDiff / cntBetween * i;
                const latS = distributeLat ? latDiff / cntBetween : defWidthLat; // latitude size of the rectangle
                const lngS = distributeLng ? lngDiff / cntBetween : defWidthLng; // longitude size of the rectangle
                const path = haveOverride?.path ?? [
                    { lat: latC - latS / 2, lng: lngC - lngS / 2 },
                    { lat: latC + latS / 2, lng: lngC - lngS / 2 },
                    { lat: latC + latS / 2, lng: lngC + lngS / 2 },
                    { lat: latC - latS / 2, lng: lngC + lngS / 2 },
                ];
                drawPoly(map, bounds, base.category, base.title ?? currentName, base.description ?? "Stellplatz", base.url, path, base.images);
            });
        } else if (area.path)
            drawPoly(map, bounds, area.category, area.title, area.description, area.url, area.path, area.images);
    });

    map.fitBounds(bounds);

    map.addListener("zoom_changed", () => {
        const show = map.getZoom() >= 18;
        staticMarkers.forEach(m => m.setMap(show ? map : null));
    });

    if (mobile) {
        document.getElementById("legend").hidden = true;
        document.getElementById("map").style.height = `50dvh`;
    } else {
        createLegend();
    }

    document.getElementById("search").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            this.blur();
            startSearch(map);
        }
    });
}


/*
<!DOCTYPE html>
<html>
<link rel="stylesheet" href="https://webmaster-fsg-alfdorf.github.io/fsg-alfdorf/src/public/interactivemap.css">
<body>
    <div id="map" style="width:100%; height:100vh"></div>
    <input style="position:absolute; top:60px; left:10px; z-index: 999" type="text" autocomplete="off" id="search" placeholder="Suchen (Person/Platz/...)">
    <div id="legend"
        style="position:absolute; top:100px; left:10px; z-index: 999; background:white; padding:10px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.3); font-family:sans-serif; font-size:14px;">
        <strong>Legende</strong>
    </div>

    <script>
        window.initMap = function () { window.parent.postMessage("ready", "*"); };
        window.onmessage = (event) => { if (event.data) drawCMSContent(event.data); };
    </script>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCerYSObwqwjPepIBEwZUn4Q1Zgee-f7RI&callback=initMap" async defer></script>
    <script src="https://webmaster-fsg-alfdorf.github.io/fsg-alfdorf/src/public/interactivemap.js"></script>
</body>
</html>
*/

/*
import wixData from 'wix-data';

$w.onReady(async function () {
    $w("#htmlMap").onMessage(async (event) => {
        if (event.data === "ready") {
            const { items } = await wixData.query("mapAreas").limit(1000).find();
            $w("#htmlMap").postMessage(items);
        }
    });
});
*/