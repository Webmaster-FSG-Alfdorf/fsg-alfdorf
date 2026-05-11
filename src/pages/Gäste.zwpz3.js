import wixLocation from 'wix-location';
import { initGuestsEditor } from 'public/cms_guests';
import { dateRangeToString } from 'public/cms.js';

$w.onReady(function () {
    initGuestsEditor(false, {});
    $w("#datasetReservations").onReady(async () => {
        console.log("#datasetReservations onReady");

        const query = wixLocation.query;
        if (query.lodging) {
            $w("#inputLodging").value = query.lodging;
            await $w("#datasetReservations").setFieldValue("lodging", query.lodging);
            $w("#inputLodging").scrollTo()
        }

        $w("#datasetVisitorPrices").onReady(async () => {
            const result = await $w("#datasetVisitorPrices").getItems(0, $w("#datasetVisitorPrices").getPageSize());
            $w("#tableVisitorPrices").rows = result.items.map(item => {
                const parts = [];
                if (item.perDay) parts.push("Tag");
                if (item.perNight) parts.push("Nacht");
                if (item.perAdult) parts.push("Erwachsene(r)");
                if (item.perReservation) parts.push("Reservierung");
                const rangeStr = parts.length > 0 ? ` pro ${parts.join("/")}` : "";
                return {
                    ...item,
                    price: item.price ? `${item.price.toFixed(2)} €${rangeStr}` : rangeStr,
                    dateRange: item.start ? dateRangeToString(item.start, item.end, { year: null, weekday: null, hour: null, minute: null }) : ""
                };
            });
        });
    });
});
