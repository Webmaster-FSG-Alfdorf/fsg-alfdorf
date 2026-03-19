import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

import { CmsEditor, FieldType, FilterType } from 'public/cms_edit.js';
import { dateRangeToString, FormatTypesMonth, toUTC, toLocal, incUTCDate, nightsBetween } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, getAllLodgingNames, generateCostsTable, generateHTMLTable } from 'backend/common.jsw';

let currentDateOccupied = "";
let occupationsRange = [new Date(), new Date()];
let editor;

$w.onReady(function () {
    wixData.query("lodgings").ascending("order").find().then(async (results) => {
        let options = [];
        let batchRequests = [];
        // main lodgings go first
        results.items.forEach((lodging) => {
            options.push({ label: lodging.title, value: `${lodging.lodgingID}|0` });
        });
        // then all sub lodgings
        for (const lodging of results.items) if (lodging.capacity > 1)
            for (let index = 1; index <= lodging.capacity; index++) batchRequests.push({
                lodging: lodging.lodgingID,
                lodgingSub: index
            });
        if (batchRequests.length > 0) {
            const names = await getAllLodgingNames(batchRequests);
            options.push(...batchRequests.map((req, i) => ({ label: names[i], value: `${req.lodging}|${req.lodgingSub}` })));
        }
        $w("#inputLodging").options = options;
        $w("#filterLodging").options = [{ label: "(Alle)", value: "*" }, ...options];
        if (editor) editor.updateUiFromData();
    });

    $w("#datasetReservations").onReady(async () => {
        console.log("#datasetReservations onReady");
        const dt = toUTC(new Date());
        dt.setUTCHours(0, 0, 0);
        postMessageToDatePicker({ minDate: new Date(dt), maxDate: incUTCDate(dt, 365) });
        const query = wixLocation.query;
        if (query.lodging) {
            $w("#inputLodging").value = query.lodging;
            await $w("#datasetReservations").setFieldValue("lodging", query.lodging);
            $w("#inputLodging").scrollTo()
        }

        $w("#htmlDate").onMessage(async (event) => {
            console.log("received message", event.data);
            if (event.data?.selectedDates?.length == 2) {
                $w("#inputDate").value = dateRangeToString(event.data.selectedDates[0], event.data.selectedDates[1], { hour: null, minute: null });
                await editor.updateDataFromUi("#inputDate");
            }
            if (event.data?.displayedMonth && event.data?.displayedYear) {
                occupationsRange = [
                    new Date(event.data.displayedYear, event.data.displayedMonth - 1, 21),
                    new Date(event.data.displayedYear, event.data.displayedMonth + 1, 7)
                ];
                syncUI(false, false);
            }
        });

        // special block below only for Management site -- all above shall be identical with Guest site

        editor = new CmsEditor({
            cmsName: "guestReservations",
            dataSetName: "datasetReservations",

            cmsSchema: {
                "#inputState": { field: "state", type: FieldType.STRING },
                "#inputLodging": {
                    fields: ["lodging", "lodgingSub"], type: FieldType.CUSTOM,
                    onParseUserInput: (input) => {
                        const lodging = input.split("|");
                        return [lodging[0], Number(lodging[1] || 0)];
                    },
                    onFormatValue: (item) => item && item.lodging ? `${item.lodging}|${item.lodgingSub ?? 0}` : "",
                    onDisplayValue: async (item) => item ? await generateLodgingName(item) : null,
                    onChanged: () => syncUI(true, false)
                },
                "#inputDate": {
                    fields: ["dateFrom", "dateTo"], type: FieldType.DATE_RANGE,
                    onChanged: () => syncUI(true, false)
                },
                "#inputArrivalTime": {
                    field: "dateFrom", type: FieldType.HOURS_OF_DATE,
                    onDisplayValue: (item) => $w("#inputArrivalTime").options.find(o => o.value == toLocal(item?.dateFrom).getHours().toString())?.label,
                    onChanged: () => syncUI(true, false)
                },
                "#inputDepartureTime": {
                    field: "dateTo", type: FieldType.HOURS_OF_DATE,
                    onDisplayValue: (item) => $w("#inputDepartureTime").options.find(o => o.value == toLocal(item?.dateTo).getHours().toString())?.label,
                    onChanged: () => syncUI(true, false)
                },
                "#inputAdults": { field: "cntAdults", type: FieldType.NUMBER, onChanged: () => updateCostsTable() },
                "#inputChildren": { field: "cntChildren", type: FieldType.NUMBER, onChanged: () => updateCostsTable() },
                "#inputFirstName": { field: "firstName", type: FieldType.STRING },
                "#inputLastName": { field: "lastName", type: FieldType.STRING },
                "#inputMail": { field: "email", type: FieldType.STRING, linkButton: "#buttonSendMail", linkPrefix: "mailto:" },
                "#inputPhone": { field: "phoneNumber", type: FieldType.STRING, linkButton: "#buttonPhone", linkPrefix: "tel:" },
                "#inputAddress": { field: "address", type: FieldType.ADDRESS },
                "#inputNotes": { field: "notes", type: FieldType.STRING },
                "#inputPrivacyPolicy": { field: "privacyPolicy", type: FieldType.BOOLEAN },
                "#inputDeposit": { field: "deposit", type: FieldType.MULTI_SELECT, onChanged: () => updateCostsTable() },
                "#inputPaidSum": { field: "paidSum", type: FieldType.NUMBER, onChanged: () => updateCostsTable(), fractionDigits: 2, suffix: "€" },
                "#inputPaidSumup": { field: "paidSumup", type: FieldType.STRING, showToUser: false },
                "#inputComment": { field: "comment", type: FieldType.STRING, showToUser: false },
            },

            filterSortField: "_updatedDate",
            filterSortAscending: false,
            filterSchema: {
                "#filterSearch": {
                    type: FilterType.CONTAINS,
                    field: "searchField",
                    skip: (val) => !val || !isNaN(Number(val)),
                    value: (val) => val.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
                },
                "#filterSearch   numeric": {
                    id: "#filterSearch",
                    type: FilterType.EQ,
                    orCombined: true,
                    fields: ["cntAdults", "cntChildren", "paidSum", "lodgingSub"],
                    skip: (val) => isNaN(Number(val)),
                    value: (val) => Number(val)
                },
                "#filterAlsoPast": {
                    type: FilterType.GE,
                    skip: (val) => val, // only apply if not checked
                    value: () => incUTCDate(new Date(), 1),
                    field: "dateTo",
                },
                "#filterStatus": {
                    type: FilterType.EQ,
                    skip: (val) => !val || val == "*",
                    field: "state"
                },
                "#filterLodging": {
                    type: FilterType.EQ,
                    skip: (val) => [!val || val == "*"],
                    value: (val) => [val.split("|").map((v, i) => i == 0 ? v : Number(v))],
                    fields: ["lodging", "lodgingSub"],
                }
            },

            onRefreshUI: async () => {
                await syncUI(true, true);
            },

            generateTitle: (item) => {
                if (item && (item.dateFrom || item.dateTo || item.lastName || item.lodging)) {
                    const startDate = dateRangeToString(item.dateFrom, null, { month: FormatTypesMonth.short, weekday: null, hour: null, minute: null });
                    const nights = `+${nightsBetween(item.dateFrom, item.dateTo)}N`;
                    return `${startDate} ${nights} ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub > 0 ? item.lodgingSub : ""}`.trim();
                } else
                    return "(Neue Reservierung)";
            },

            onBeforeSave: async () => {
                await syncUI(true, false);
                if (currentDateOccupied) {
                    wixWindow.openLightbox("CMSSuccessLightbox", { msg: "Speichern nicht möglich", customMessage: currentDateOccupied });
                    return null;
                }
                const item = editor.ds.getCurrentItem();
                return editor.originalItem && item && editor.originalItem.state != item.state ? {
                    "Anfrage": "Der Status wurde zurückgesetzt auf eine unverbindliche Anfrage.",
                    "Reserviert": "Ihre Anfrage wurde akzeptiert.",
                    "Bezahlt": "Ihre Reservierung wurde als bezahlt markiert.",
                    "Abgelehnt": "Ihre Anfrage wurde abgelehnt."
                }[item.state] || "" :
                    "";
            },

            onAfterSave: (diff, customMessage) => {
                if (diff.diffUser.length > 0)
                    wixWindow.openLightbox("CMSSuccessLightbox", {
                        msg: "Änderungen wurden gespeichert",
                        item: editor.ds.getCurrentItem(),
                        diff: diff.diffIntern,
                        diffUser: diff.diffUser,
                        customMessage
                    });
            },

            onAfterReverted: () => {
                wixWindow.openLightbox("CMSSuccessLightbox", { msg: "Änderungen wurden zurückgesetzt" });
            },

            onAfterDelete: (deletedItem) => {
                wixWindow.openLightbox("CMSSuccessLightbox", {
                    msg: "Reservierung wurde gelöscht",
                    item: deletedItem,
                    customMessage: "Ihre Reservierungsanfrage wurde storniert."
                });
            },
        });

        editor.init();

        wixData.query("pricesVisitor").ascending("order").find().then((results) => {
            let options = [];
            results.items.forEach((pv) => {
                if (pv.depositName) options.push({ label: pv.title, value: pv.depositName });
            });
            $w("#inputDeposit").options = options;
        });

        // end special block
    });
});

function updateCostsTable() {
    const item = editor.ds.getCurrentItem();
    if (item)
        generateCostsTable(item).then(costs => {
            generateHTMLTable(costs, [
                "Leistung",
                { label: "Anzahl Erw.", align: "right" },
                { label: "Nächte", align: "right" },
                { label: "Einzelpreis", align: "right" },
                { label: "Gesamt", align: "right" },
            ]).then(html => $w("#textReservationPrice").html = html);
        });
    else
        $w("#textReservationPrice").html = "";
    return true;
}

function postMessageToDatePicker(message) {
    console.log("postMessage to #htmlDate", message);
    $w("#htmlDate").postMessage(message);
}

async function syncUI(checkValidation = true, resetCalendarView = false) {
    console.log("syncUI", checkValidation, resetCalendarView);
    const item = editor.ds.getCurrentItem();
    if (!item) return;

    updateCostsTable();

    let message = { capacity: 0, occupations: [] };
    let valRes = { noLodging: !item.lodging };

    if (item.lodging) {
        const [occ, checkRes] = await Promise.all([
            getOccupations(item.lodging, item.lodgingSub, new Date(occupationsRange[0]), new Date(occupationsRange[1]), item._id),
            checkValidation ?
                isDateOccupied(item.lodging, item.lodgingSub, item.dateFrom, item.dateTo, true, item._id) :
                Promise.resolve({ occupied: false })
        ]);

        if (item.lodgingSub > 0 && occ.capacity >= 1) {
            occ.occupations.forEach(day => { day.count = day.count >= occ.capacity ? 1 : 0; });
            occ.capacity = 1;
        }
        message = { capacity: occ.capacity, occupations: occ.occupations };
        valRes = checkRes;
    }

    if (resetCalendarView) message.utcDates = item.dateFrom && item.dateTo ? [new Date(item.dateFrom), new Date(item.dateTo)] : [null, null];
    if (checkValidation) {
        if (valRes?.noLodging)
            currentDateOccupied = "Bitte zuerst eine Unterkunft wählen.";
        else if (!valRes || !valRes.occupied)
            currentDateOccupied = "";
        else if (valRes.suggestedArrival)
            currentDateOccupied = `Belegt. Ankunft erst ab ${valRes.suggestedArrival} Uhr möglich.`;
        else if (valRes.suggestedDeparture)
            currentDateOccupied = `Belegt. Abreise bis spätestens ${valRes.suggestedDeparture} Uhr nötig.`;
        else
            currentDateOccupied = "Der Zeitraum ist in dieser Unterkunft bereits belegt.";

        ["#inputDate", "#inputArrivalTime", "#inputDepartureTime"].forEach(id => $w(id).updateValidityIndication());
    }

    postMessageToDatePicker(message);
}
