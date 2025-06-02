import wixWindowFrontend from "wix-window-frontend";

import { sendMails, generateHTMLTable } from 'backend/common.jsw';

$w.onReady(function () {
    const data = wixWindowFrontend.lightbox.getContext();
    if (data && data.msg) $w('#textSuccess').text = data.msg;

    //if (data.diff) $w("#buttonDetails").show(); TODO layout of the details not working correctly
    $w("#buttonDetails").onClick(async () => {
        $w("#buttonDetails").hide();
        $w('#textSuccess').html = "<html>" + data.msg + await generateHTMLTable(data.diff, ["Änderung", "Von", "Nach"]) + "</html>";
    });

    if (data.item && (data.diffUser || data.customMessage)) $w("#buttonSendMail").show();
    $w("#buttonSendMail").onClick(() => {
        //TODO allow custom message : edit before send
        sendMails(data.item, false, data.customMessage ?? "", data.diffUser ?? []);
    });
});