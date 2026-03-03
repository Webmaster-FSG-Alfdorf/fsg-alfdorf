import wixData from 'wix-data';
import wixWindow from 'wix-window';

$w.onReady(async function () {
    $w("#buttonMap").onClick(() => {
        wixWindow.openLightbox("InteractiveMap");
    });

    $w("#htmlMap").onMessage((event) => async () => {
        if (event.data === "ready") {
            const { items } = await wixData.query("mapAreas").find();
            $w("#htmlMap").postMessage(items);
        }
    });
});
