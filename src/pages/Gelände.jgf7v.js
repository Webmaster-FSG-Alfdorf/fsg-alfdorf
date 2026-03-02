import wixWindow from 'wix-window';

$w.onReady(() => {
    $w("#buttonMap").onClick(() => {
        wixWindow.openLightbox("InteractiveMap");
    });

    $w("#htmlMap").onMessage((event) => {
        if (event.data === "ready") {
            $w("#htmlMap").postMessage("TODO: Pass any necessary data to the iframe here");
        }
    });
});
