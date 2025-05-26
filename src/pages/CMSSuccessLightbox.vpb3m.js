import wixWindowFrontend from "wix-window-frontend";

$w.onReady(function () {
    const data = wixWindowFrontend.lightbox.getContext();
    if (data && data.msg) $w('#textSuccess').text = data.msg;
    
    if (data.details) $w("#buttonDetails").show();
    $w("#buttonDetails").onClick(() => {
        $w("#buttonDetails").hide();
        $w('#textSuccess').text += "\n" + data.details;
    });
    
    if (data.confirmations) $w("#buttonSendMail").show();
    $w("#buttonSendMail").onClick(() => {

    });
});