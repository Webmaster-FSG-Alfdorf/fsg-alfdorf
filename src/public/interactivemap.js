/* global google */

const flashDelay = 500;
const polyFillOpacity = 0.3;
const polyBorderWidth = 0.3;

const categories = {
    sport: { color: "#ffcc00", legend: "Sportplätze", opacity: polyFillOpacity },
    infra: { color: "#2196f3", legend: "Infrastruktur", opacity: polyFillOpacity },
    places: { color: "#ff0000", legend: "Wohnwagen-Plätze", opacity: 0.0 },
};

// an array of array with [place nr first, place nr last, latitude of center point first, longitude of center point first, latitude of center point last, longitude of center point last, ]
// each such array defines a stripe of equaly distributed places
const places = [
    [1, 18, 48.83575977980719, 9.763329800116484, 48.8373670028252, 9.763395194141582, { 16: "16a", 17: "16b", 18: "16c" }],
    [17, 26, 48.83633097514284, 9.763506424511618, 48.837156055803014, 9.763597303632862],
    [26, 32, 48.836539221564585, 9.763718603912853, 48.837062440499906, 9.763793679924333, { 26: "27a", 27: "27b" }],
    [33, 34, 48.83715799798317, 9.763844313668455, 48.83725602968279, 9.763948928670361],
    [35, 42, 48.83661293301137, 9.763862864599455, 48.83719817579144, 9.764027775468218],
    [43, 49, 48.83650495368246, 9.764006995755722, 48.837099327277585, 9.764124142956964],
    [50, 52, 48.83662401888115, 9.76416343005434, 48.836870631921, 9.764220931828527, { 51: "51a", 52: "51b" }],
    [52, 55, 48.835620446732456, 9.76350271323776, 48.83594508147658, 9.763574468528457],
    [56, 60, 48.83558995854129, 9.763796659884786, 48.836092986240914, 9.763869306728248],
    [61, 61, 48.83617907642538, 9.763747294938572],
    [62, 64, 48.835754238521616, 9.76396339024913, 48.835997439541615, 9.764025779538816],
    // 65 ???
    [66, 68, 48.83602927244979, 9.764188067168485, 48.836233158800944, 9.764272979454592],
    [69, 70, 48.83567000006237, 9.764180332312964, 48.83567445026981, 9.764337888210795],
    // 71 ???
    [88, 88, 48.83635976830587, 9.764333386670462, null, null, { 88: "88 ???" }],
    [72, 75, 48.83595075634674, 9.76429645585823, 48.836227941473815, 9.764410298332301, { 75: "75a" }],
    [75, 75, 48.836315232020254, 9.764486022962728, null, null, { 75: "75b" }],
    [75, 75, 48.83642155709868, 9.764661630195354, null, null, { 75: "75c" }],
    [76, 82, 48.83579648910798, 9.764333734514906, 48.83629219884369, 9.76460345990195],
    [83, 89, 48.838025890354764, 9.76456286434779, 48.83841502919975, 9.76526876253226, { 88: "88a ???", 89: "88b ???" }],
    [89, 96, 48.836933553520986, 9.764451193381408, 48.83762380215355, 9.764576598975896, { "93_name": "Oliver Hoffmann und Katrin Feisst - EDV<br>WLAN/Wifi<br>Kegelbahn<br>Volleyball" }],
    [97, 104, 48.8377249811905, 9.764658473445385, 48.83814164930723, 9.765360277010771, { 103: "103 ???", 104: "104 ???" }],
    [104, 111, 48.83699352256115, 9.764613652257806, 48.83760122032082, 9.764759719592085, { 104: "105a", 105: "105b" }],
    [112, 117, 48.83767668884647, 9.764802689616243, 48.837981295644944, 9.765297655986885],
    [118, 119, 48.836727887064, 9.76457178467303, 48.836810959549055, 9.76465863902205],
    [120, 127, 48.83689394878972, 9.76473713452227, 48.837559011855504, 9.76490722029549],
    [128, 131, 48.83764616043329, 9.764968001370395, 48.83782678000071, 9.765231027350131],
    [132, 132, 48.83784481912853, 9.765380907264296],
    [133, 138, 48.836420285283516, 9.764444586292592, 48.83673339516497, 9.764889523228835],
    [139, 145, 48.836804115454484, 9.764927423184337, 48.83727276209053, 9.765210035720376],
    [146, 152, 48.837368510735025, 9.765361530210294, 48.83777405489207, 9.765877761912517],
    [153, 159, 48.83731775102703, 9.765514153377355, 48.83769677797568, 9.76605968694413],
    [160, 166, 48.83726178811318, 9.765663880136582, 48.83763687323549, 9.766165263913743],
    [167, 172, 48.83722620032888, 9.765809580793688, 48.837553734924086, 9.766240303100558],
    [173, 178, 48.83716461725875, 9.76593715048998, 48.83747789876839, 9.766354434445368],
    [179, 184, 48.83709901873594, 9.766099422942647, 48.83738943752883, 9.766454759125988],
    // 185 ???
    [186, 192, 48.83578471569172, 9.764527334244633, 48.836260254053336, 9.76475913677535],
    [193, 195, 48.8363337301438, 9.76480585296901, 48.83652347387646, 9.764980093732714],
    // 196 .. 200 ???
    [201, 203, 48.83803844576284, 9.76541169526301, 48.83825327454763, 9.765561853059593],
    // 204 .. 213 ???
    [214, 218, 48.83790859853366, 9.765516024404873, 48.83822771573304, 9.765690480873301],
    [219, 224, 48.83831717427098, 9.765745926387021, 48.838724806594236, 9.766034640374722],
    [225, 228, 48.838782351034176, 9.766112895799285, 48.83897525192222, 9.766346218812256],
    [229, 235, 48.838467541784105, 9.766018164081338, 48.838882115066916, 9.766430605159279],
    [236, 240, 48.83854851024745, 9.76624427110358, 48.83880778534419, 9.766529292898875],
];

let map;
let bounds;
let mobile = false;
let areas = [];

function drawCMSContent(areasCMS) {

    class TooltipOverlay extends google.maps.OverlayView {
        constructor(position, name, descr, images) {
            super();
            this.position = position;
            this.name = name;
            this.descr = descr;
            this.images = images;
            this.div = null;
        }

        onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.background = 'rgba(255, 255, 255, 0.9)';
            this.div.style.border = '1px solid #999';
            this.div.style.borderRadius = '8px';
            this.div.style.padding = '8px 12px';
            this.div.style.fontSize = '14px';
            this.div.style.color = '#333';
            this.div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
            this.div.style.pointerEvents = 'none';
            this.div.style.maxWidth = '220px';
            this.div.style.lineHeight = '1.4';
            let content = `<strong>${this.name}</strong><br>${this.descr}`;
            if (this.images != null && this.images.length > 0) for (const image of this.images)
                content += `<img src="${image}" style="width:100%; height:auto; margin-top:8px; border-radius:4px; display:block;">`;
            this.div.innerHTML = content;
            this.getPanes().overlayMouseTarget.appendChild(this.div);
        }

        draw() {
            if (this.div) {
                const pos = this.getProjection().fromLatLngToDivPixel(this.position);
                this.div.style.left = `${pos.x}px`;
                this.div.style.top = `${pos.y - 30}px`;
            }
        }

        onRemove() {
            if (this.div) this.div.remove();
            this.div = null;
        }
    }

    function drawPoly(map, bounds, cat, name, descr, url, paths, images = null) {

        const poly = new google.maps.Polygon({
            paths: paths,
            map,
            fillColor: categories[cat].color,
            fillOpacity: categories[cat].opacity,
            strokeWeight: polyBorderWidth,
        });
        // handle a tooltip when moving mouse over the place
        let tooltip;
        poly.addListener("mouseover", (e) => {
            tooltip = new TooltipOverlay(e.latLng, name, descr, images);
            tooltip.setMap(map);
        });
        poly.addListener("mouseout", () => {
            if (tooltip) {
                tooltip.setMap(null);
                tooltip = null;
            }
        });

        if (url != "") poly.addListener("click", () => { window.open(url, "self"); });

        poly.getPath().forEach(latlng => bounds.extend(latlng));

        return poly;
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
        const bounds = new google.maps.LatLngBounds();
        let s = document.getElementById("search").value.trim().toLowerCase();
        let found = false
        if (s) {
            if (s.startsWith("nr ")) s = s.substring(3).trim();
            if (s.startsWith("platz ")) s = s.substring(6).trim();
            if (s.startsWith("place ")) s = s.substring(6).trim();
            areas.forEach(area => {
                if (area.poly && (area.name.toLowerCase().includes(s) || area.descr.toLowerCase().includes(s))) {
                    found = true;
                    flashPoly(bounds, area.poly, area.category);
                }
            });
            places.forEach(stripe => {
                const opts = stripe[6];
                if (opts && opts["poly"]) {
                    if (opts["nrs"]) opts["nrs"].forEach((nr, i) => {
                        const c = nr[s.length];
                        if (nr.startsWith(s) && !(c >= '0' && c <= '9')) {
                            found = true;
                            flashPoly(bounds, opts["poly"][i], "places");
                        }
                    });
                    if (opts["names"]) opts["names"].forEach((name, i) => {
                        if (name.toLowerCase().includes(s)) {
                            found = true;
                            flashPoly(bounds, opts["poly"][i], "places");
                        }
                    });
                }
            });
        }
        if (found) map.fitBounds(bounds);
    }

    function flashPoly(bounds, poly, cat) {
        const optFlash = { fillOpacity: 1 };
        const optOrg = { fillOpacity: categories[cat].opacity };
        poly.setOptions(optFlash);
        setTimeout(() => { poly.setOptions(optOrg); }, flashDelay);
        setTimeout(() => { poly.setOptions(optFlash); }, flashDelay * 2);
        setTimeout(() => { poly.setOptions(optOrg); }, flashDelay * 3);
        setTimeout(() => { poly.setOptions(optFlash); }, flashDelay * 4);
        setTimeout(() => { poly.setOptions(optOrg); }, flashDelay * 5);
        poly.getPath().forEach(latlng => bounds.extend(latlng));
    }


    // actual start of drawCMSContent
    /////////////////////////////////

    areas = areasCMS;
    console.log("drawCMSContent", typeof google, areas);
    if (typeof google === "undefined") return;

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

    console.log("drawCMSContent", "drawing CMS content");

    areas.forEach(area => {
        area.poly = drawPoly(
            map,
            bounds,
            area.category,
            area.title ?? "",
            area.description ?? "",
            area.url,
            area.path,
            area.images.map((img => img.src))
        )
    });

    const defWidthLat = 9.0 / 111320; // width of the stripe in case of latitude: 9m
    const defWidthLng = 9.0 / (111320 * Math.cos(48.84 * Math.PI / 180)); // width of the stripe in case of longitude: 9m at ~49°
    places.forEach(stripe => {
        const [nr0, nrN, lat0, lng0, latN = lat0, lngN = lng0, opts = {}] = stripe;
        const cnt = nrN - nr0; // number of places between
        const latDiff = latN - lat0;
        const lngDiff = lngN - lng0;
        // check in which direction we want to distribute our places (in none, if we only have one)
        const distributeLng = lngDiff > latDiff && cnt > 0;
        const distributeLat = lngDiff < latDiff && cnt > 0;
        const poly = [];
        const names = [];
        const nrs = [];
        for (let i = 0; i <= cnt; ++i) {
            const latC = cnt == 0 ? lat0 : lat0 + latDiff / cnt * i;
            const lngC = cnt == 0 ? lng0 : lng0 + lngDiff / cnt * i;
            const latS = distributeLat ? latDiff / cnt : defWidthLat; // latitude size of the rectangle
            const lngS = distributeLng ? lngDiff / cnt : defWidthLng; // longitude size of the rectangle
            const nr = `${opts[nr0 + i] ?? nr0 + i}`;
            const name = opts[`${nr0 + i}_name`] ?? opts[`${nr}_name`] ?? "";
            names.push(name);
            nrs.push(nr);
            poly.push(drawPoly(map, bounds, "places", nr, name || "Stellplatz", "", [
                { lat: latC - latS / 2, lng: lngC - lngS / 2 },
                { lat: latC + latS / 2, lng: lngC - lngS / 2 },
                { lat: latC + latS / 2, lng: lngC + lngS / 2 },
                { lat: latC - latS / 2, lng: lngC + lngS / 2 },
            ]));
        }
        opts["poly"] = poly;
        opts["nrs"] = nrs;
        opts["names"] = names;
        stripe[6] = opts; // in case it was null at stripe
    });

    map.fitBounds(bounds);

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