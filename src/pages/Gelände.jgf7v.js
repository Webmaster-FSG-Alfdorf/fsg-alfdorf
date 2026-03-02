import wixWindow from 'wix-window';

$w.onReady(async function () {
    $w("#buttonMap").onClick(() => {
        wixWindow.openLightbox("InteractiveMap");
    });

    const { items } = await wixData.query("mapAreas").find();

    const formattedAreas = items.map(item => ({
        name: item.title,
        descr: item.description,
        category: item.category,
        placeNumber: item.placeNumber,
        url: item.url,
        path: item.path ? JSON.parse(item.path) : [],
        images: item.images ? item.images.map(img => img.src.split('/').pop()) : []
    }));

    $w("#htmlMap").onMessage((event) => {
        if (event.data === "ready") {
            $w("#htmlMap").postMessage(formattedAreas);
        }
    });
});
