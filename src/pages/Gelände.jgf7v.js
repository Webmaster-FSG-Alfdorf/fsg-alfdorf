import wixWindow from 'wix-window';

$w.onReady(() => {
    $w("#buttonMap").onClick(() => {
        wixWindow.openLightbox("InteractiveMap");
    });
});