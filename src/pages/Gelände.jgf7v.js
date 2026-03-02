import wixData from 'wix-data';
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
        path: item.path,
        images: item.images
    }));

    $w("#htmlMap").onMessage((event) => {
        if (event.data === "ready") {
            $w("#htmlMap").postMessage(formattedAreas);
        }
    });
});
