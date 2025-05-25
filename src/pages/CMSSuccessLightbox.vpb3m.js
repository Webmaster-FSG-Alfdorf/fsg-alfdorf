import wixWindowFrontend from "wix-window-frontend";

$w.onReady(function () {
    const data = wixWindowFrontend.lightbox.getContext();
    if (data && data.msg) $w('#textSuccess').text = data.msg;
    if (data.confirmations) $w("#buttonSendMail").show();
    if (data.confirmations) $w("#buttonEditMail").show();
    if (data.details) $w("#buttonDetails").show();
    $w("#buttonDetails").onClick(() => {
        $w("#buttonDetails").hide();
        $w('#textSuccess').text += "\n" + data.details;
    });
});