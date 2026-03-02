import wixWindow from 'wix-window';

$w.onReady(async function () {
    $w("#buttonMap").onClick(() => {
        wixWindow.openLightbox("InteractiveMap");
    });

    //  const { items } = await wixData.query("mapAreas").find();

    // 2. Daten für Google Maps aufbereiten
    const formattedAreas = []; //items.map(item => ({
    /*
    name: item.title,
    descr: item.description,
    category: item.category, // sport, infra, places
    url: item.url || "",
    // Falls dein Pfad im CMS als Text/String gespeichert ist:
    path: typeof item.path === 'string' ? JSON.parse(item.path) : item.path,
    images: item.imageGallery ? item.imageGallery.map(img => img.src.split('/').pop()) : []
}));
*/
    $w("#htmlMap").onMessage((event) => {
        if (event.data === "ready") {
            $w("#htmlMap").postMessage(formattedAreas);
        }
    });
});
