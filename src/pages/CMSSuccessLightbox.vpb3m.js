import wixWindowFrontend from "wix-window-frontend";

$w.onReady(function () {
    const data  = wixWindowFrontend.lightbox.getContext();
	if (data && data.diff) $w('#textSuccess').text += data.diff;
});