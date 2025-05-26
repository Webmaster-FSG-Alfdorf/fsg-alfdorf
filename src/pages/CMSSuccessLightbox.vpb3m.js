import wixWindowFrontend from "wix-window-frontend";

import { sendMails } from 'backend/common.jsw';

$w.onReady(function () {
    const data = wixWindowFrontend.lightbox.getContext();
    if (data && data.msg) $w('#textSuccess').text = data.msg;

    if (data.details) $w("#buttonDetails").show();
    $w("#buttonDetails").onClick(() => {
        $w("#buttonDetails").hide();
        $w('#textSuccess').text += "\n" + data.details;
    });

    if (data.msgCustomer && data.item) $w("#buttonSendMail").show();
    $w("#buttonSendMail").onClick(() => {
        //TODO allow custom message : edit before send
        sendMails(data.item, false, data.msgCustomer);
    });
});