import wixWindowFrontend from "wix-window-frontend";

import { sendMail } from 'backend/common.jsw';

$w.onReady(function () {
    const data = wixWindowFrontend.lightbox.getContext();
    $w("#textTitle").html = (data?.msg || "Hinweis");

    if (data?.details) $w("#buttonDetails").show();
    $w("#buttonDetails").onClick(async () => {
        $w("#buttonDetails").hide();
        $w("#textDetails").html = data?.details || "";
        $w("#textDetails").expand();
    });

    if (data?.emailId && data?.item?.email) $w("#buttonSendMail").show();
    $w("#buttonSendMail").onClick(() => {
        //TODO allow custom message : edit before send
        sendMail(data.emailId, data.item, data.emailOptions || {});
    });

    $w("#buttonClose").onClick(() => {
        wixWindowFrontend.lightbox.close();
    });
});