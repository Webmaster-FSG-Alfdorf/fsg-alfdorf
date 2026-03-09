import wixData from 'wix-data';
import wixLocation from 'wix-location';

import { dateRangeToString, FormatTypesMonth, FormatTypesWeekday, FormatTypesNumeric, stringToDateRange, toUTC, toLocal, incUTCDate } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, generateCostsTable, generateHTMLTable } from 'backend/common.jsw';

let currentDate = [new Date(), new Date()];
let currentDateOccupied = "";
let occupationsFrom = new Date();
let occupationsTo = new Date();

$w.onReady(function () {
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

    wixData.query("lodgings").ascending("order").find().then(async (results) => {
        let options = [];

        for (const lodging of results.items) {
            // 1. Hauptunterkunft hinzufügen (z.B. "Haus A")
            options.push({
                label: lodging.title,
                value: `${lodging.lodgingID}|0`
            });

            // 2. Direkt danach alle zugehörigen Sub-Lodgings (z.B. "Haus A - Zimmer 1", etc.)
            if (lodging.capacity > 1) {
                for (let index = 1; index <= lodging.capacity; index++) {
                    const subLabel = await generateLodgingName({
                        lodging: lodging.lodgingID,
                        capacityPrefix: lodging.capacityPrefix,
                        lodgingSub: index
                    });

                    options.push({
                        label: subLabel,
                        value: `${lodging.lodgingID}|${index}`
                    });
                }
            }
        }

        // Erst wenn alle Haupt- und Sub-Lodgings fertig generiert sind, die UI aktualisieren
        $w("#inputLodging").options = options;
    });

    $w("#datasetGuestReservations").onReady(() => {

        const query = wixLocation.query;
        if (query.lodging) {
            $w("#inputLodging").value = query.lodging;
            $w("#datasetGuestReservations").setFieldValue("lodging", query.lodging);
            $w("#inputLodging").scrollTo()
        }

        $w("#htmlDate").onMessage((event) => {
            if (event.data && Array.isArray(event.data.selectedDates) && event.data.selectedDates.length == 2) {
                currentDate = [new Date(event.data.selectedDates[0]), new Date(event.data.selectedDates[1])];
                updateForm(true);
            }
            if (event.data && event.data.displayedMonth && event.data.displayedYear) {
                occupationsFrom = new Date(event.data.displayedYear, event.data.displayedMonth - 1, 21);
                occupationsTo = new Date(event.data.displayedYear, event.data.displayedMonth + 1, 7);
                updateForm(true);
            }
        });

        updateForm(false);
        $w("#inputLodging").onChange((event) => { updateForm(true); })
        $w("#inputAdults").onChange((event) => { updateForm(false); })
        $w("#inputChildren").onChange((event) => { updateForm(false); })
        $w("#inputArrivalTime").onChange((event) => { updateForm(true); })
        $w("#inputDepartureTime").onChange((event) => { updateForm(true); })

        $w("#inputDate").onKeyPress((event) => { if (event.key == "Enter") updateCurrentDate(stringToDateRange($w("#inputDate").value)); });
        $w("#inputDate").onBlur((event) => { updateCurrentDate(stringToDateRange($w("#inputDate").value)); });

        $w("#inputDate").onCustomValidation((value, reject) => { if (currentDateOccupied) reject(currentDateOccupied); });
        $w("#inputArrivalTime").onCustomValidation((value, reject) => { if (currentDateOccupied.includes("Ankunft")) reject(currentDateOccupied); });
        $w("#inputDepartureTime").onCustomValidation((value, reject) => { if (currentDateOccupied.includes("Abreise")) reject(currentDateOccupied); });

        $w("#datasetGuestReservations").onAfterSave(() => { updateCurrentDate([new Date(), new Date()]); });
        //FIXME captcha check missing
    });
});

function updateCurrentDate(cd) {
    currentDate = cd;
    $w("#htmlDate").postMessage({ currentDate: currentDate });
    $w("#inputDate").resetValidityIndication();
    updateForm(true);
}

function updateOccupiedState(s) {
    currentDateOccupied = s;
    $w("#inputDate").resetValidityIndication();
    $w("#inputDate").value = $w("#inputDate").value; // force onCustomValidation()
    $w("#inputArrivalTime").resetValidityIndication();
    $w("#inputArrivalTime").value = $w("#inputArrivalTime").value; // force onCustomValidation()
    $w("#inputDepartureTime").resetValidityIndication();
    $w("#inputDepartureTime").value = $w("#inputDepartureTime").value; // force onCustomValidation()
}

function updateHoursAsLocal(i, id) {
    let local = toLocal(currentDate[i]);
    local.setHours(+$w(id).value, 0, 0, 0);
    currentDate[i] = toUTC(local);
}

function updateForm(updateFields) {
    updateHoursAsLocal(0, "#inputArrivalTime");
    updateHoursAsLocal(1, "#inputDepartureTime");

    const lodging = $w("#inputLodging").value.split("|");
    let dt0 = new Date(currentDate[0]);
    let dt1 = new Date(currentDate[1]);
    isDateOccupied(lodging[0], Number(lodging[1]), dt0, dt1, true).then((res) => {
        if (!res.occupied)
            updateOccupiedState("");
        else if (res.suggestedArrival)
            updateOccupiedState(`Nur möglich bei Ankunfts-Zeit nach ${res.suggestedArrival} Uhr`);
        else if (res.suggestedDeparture)
            updateOccupiedState(`Nur möglich bei Abreise-Zeit bis ${res.suggestedDeparture} Uhr`);
        else
            updateOccupiedState("Ihr Gewählter Datumsbereich ist leider nicht verfügbar");
    });

    generateCostsTable({ lodging: lodging[0], dateFrom: currentDate[0], dateTo: currentDate[1], cntAdults: Number($w("#inputAdults").value) }).then(costs => {
        generateHTMLTable(costs, [
            "Leistung",
            { label: "Anzahl Erw.", align: "right" },
            { label: "Nächte", align: "right" },
            { label: "Einzelpreis", align: "right" },
            { label: "Gesamt", align: "right" },
        ]).then(html => $w("#textReservationPrice").html = html);
    });

    $w("#inputDate").value = dateRangeToString(currentDate[0], currentDate[1], { hour: null, minute: null });

    if (updateFields) {
        $w("#datasetGuestReservations").setFieldValue("dateFrom", currentDate[0]);
        $w("#datasetGuestReservations").setFieldValue("dateTo", currentDate[1]);
        $w("#datasetGuestReservations").setFieldValue("lodging", lodging[0]);
        $w("#datasetGuestReservations").setFieldValue("lodgingSub", +lodging[1]);
        getOccupations(lodging[0], +lodging[1], new Date(occupationsFrom), new Date(occupationsTo)).then(res => {
            $w("#htmlDate").postMessage({ minDate: new Date(), maxDate: incUTCDate(new Date(), 365), capacity: res.capacity, occupations: res.occupations });
        });
    }
    //FIXME field is mandatory but not yet checked if really set on submit
}