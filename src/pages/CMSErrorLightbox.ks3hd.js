import wixWindowFrontend from "wix-window-frontend";

$w.onReady(function () {
    const data = wixWindowFrontend.lightbox.getContext();
    if (data && data.msg) $w('#textError').text = data.msg;
});
