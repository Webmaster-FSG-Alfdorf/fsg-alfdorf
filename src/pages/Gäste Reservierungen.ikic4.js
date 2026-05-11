import wixData from 'wix-data';
import { initGuestsEditor } from 'public/cms_guests';

$w.onReady(function () {
    initGuestsEditor(true, {});

    $w("#datasetReservations").onReady(async () => {
        console.log("#datasetReservations onReady");

        wixData.query("pricesVisitor").ascending("order").find().then((results) => {
            let options = [];
            results.items.forEach((pv) => {
                if (pv.depositName) options.push({ label: pv.title, value: pv.depositName });
            });
            $w("#inputDeposit").options = options;
        });

    });
});
