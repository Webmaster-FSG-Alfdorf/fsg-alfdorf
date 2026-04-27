import wixData from 'wix-data';
import wixLocation from 'wix-location';

import { CmsEditor, FieldType } from 'public/cms_edit.js';
import { dateRangeToString, FormatTypesMonth, FormatTypesNumeric, nightsBetween } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, getAllLodgingNames, generateCostsTable } from 'backend/common.jsw';

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
    });

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

        const curUTC = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0));
        const maxUTC = new Date(curUTC);
        maxUTC.setUTCMonth(maxUTC.getUTCMonth() + 6);

        editor = new CmsEditor({
            cmsName: "guestReservations",
            dataSetName: "datasetReservations",

            textResponse: $w("#textResponse"),
            buttonSave: $w("#buttonSave"),

            onGenerateEmailOptions: async (item) => ({
                ...editor.convertToEmailOptions("a", editor.getSummary($w, item)),
                ...editor.convertToEmailOptions("b", await generateCostsTable(item))
            }),

            messages: {
                itemSaved: { emailId: "ReservationUpdated", automaticMail: true },
            },

            translatedMessages: {
                itemName: "Reservierung",
                messageIds: {
                    itemSaved: "✔ Vielen Dank! Ihre Anfrage wurde gesendet",
                    itemSavedDetails: "{summary}",
                    itemSaveError: "✖ Anfrage konnte nicht gesendet werden.",
                }
            },

            cmsSchema: {
                "#inputLodging": {
                    fields: ["lodging", "lodgingSub"],
                    type: FieldType.CUSTOM,
                    required: true,
                    default: "GW|0", //TODO
                    onParseCustomUserInput: (value) => value ? value.split("|").map((v, i) => i == 0 ? v : Number(v ?? 0)) : ["", 0],
                    onFormatCustomValue: (values) => Array.isArray(values) && values.length == 2 ? `${values[0]}|${values[1] ?? 0}` : "",
                    onPrintValue: (item) => editor.lodgingNames[item?.lodging + "|" + item?.lodgingSub] ?? "",
                    onCustomValidation: async (item) => await validateLodging(item),
                    onChanged: async (item) => {
                        if (item) editor.lodgingNames[item.lodging + "|" + item.lodgingSub] = await generateLodgingName(item);
                        await updateCostsTable(item);
                    }
                },
                "#inputDate": {
                    fields: ["dateFrom", "dateTo"],
                    type: FieldType.DATE_RANGE,
                    datePicker: "#htmlDate",
                    required: true,
                    minAllowed: curUTC,
                    maxAllowed: maxUTC,
                    onDisplayedDateChanged: async () => await validateLodging(editor.ds.getCurrentItem()),
                    onChanged: async (item) => await updateCostsTable(item),
                    onPrintValue: (item) => {
                        if (!item || !item.dateFrom || !item.dateTo) return "";
                        const haveAT = new Date(item.dateFrom).getHours() != 2;
                        const haveDT = new Date(item.dateTo).getHours() != 23;
                        return dateRangeToString(item.dateFrom, item.dateTo, {
                            hour: null,
                            minute: null,
                            start: { hour: haveAT ? FormatTypesNumeric.twoDigit : null, minute: haveAT ? FormatTypesNumeric.twoDigit : null },
                            end: { hour: haveDT ? FormatTypesNumeric.twoDigit : null, minute: haveDT ? FormatTypesNumeric.twoDigit : null }
                        });
                    },
                },
                "#inputArrivalTime": {
                    field: "dateFrom",
                    default: "2", //TODO
                    required: true,
                    type: FieldType.HOURS_OF_DATE,
                    collectSummary: false,
                    collectDiff: false
                },
                "#inputDepartureTime": {
                    field: "dateTo",
                    default: "23", //TODO
                    required: true,
                    type: FieldType.HOURS_OF_DATE,
                    collectSummary: false,
                    collectDiff: false
                },
                "#inputAdults": {
                    field: "cntAdults",
                    type: FieldType.NUMBER,
                    required: true,
                    onChanged: async (item) => await updateCostsTable(item)
                },
                "#inputChildren": {
                    field: "cntChildren",
                    type: FieldType.NUMBER,
                    required: true,
                },
                "#inputFirstName": {
                    field: "firstName",
                    type: FieldType.STRING,
                    summaryLabel: "Name",
                    onPrintValue: (item) => item ? `${item.firstName} ${item.lastName}` : "",
                },
                "#inputLastName": {
                    field: "lastName",
                    required: true,
                    type: FieldType.STRING,
                    collectSummary: false,
                    collectDiff: false
                },
                "#inputMail": {
                    field: "email",
                    type: FieldType.STRING,
                    required: true,
                    linkButton: "#buttonSendMail",
                    linkPrefix: "mailto:"
                },
                "#inputPhone": {
                    field: "phoneNumber",
                    type: FieldType.STRING,
                    linkButton: "#buttonPhone",
                    linkPrefix: "tel:"
                },
                "#inputAddress": {
                    field: "address",
                    type: FieldType.ADDRESS
                },
                "#inputNotes": {
                    field: "notes",
                    type: FieldType.STRING
                },
                "#inputPrivacyPolicy": {
                    field: "privacyPolicy",
                    label: "Datenschutzerklärung",
                    required: true,
                    type: FieldType.BOOLEAN
                },
                "#captcha1": {
                    label: "Captcha",
                    required: true,
                    type: FieldType.CAPTCHA,
                    onEqualData: () => false,
                    collectDiff: false,
                    collectSummary: false
                }
            },

            generateTitle: (item) => {
                if (item && (item.dateFrom || item.dateTo || item.lastName || item.lodging)) {
                    const startDate = dateRangeToString(item.dateFrom, null, { month: FormatTypesMonth.short, weekday: null, hour: null, minute: null });
                    const nights = `+${nightsBetween(item.dateFrom, item.dateTo)}N`;
                    return `${startDate} ${nights} ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub > 0 ? item.lodgingSub : ""}`.trim();
                } else
                    return "(Neue Reservierung)";
            },

            onBeforeSave: async (item) => {
                const msg = editor.originalItem && item && editor.originalItem.state != item.state ? {
                    "Anfrage": "Der Status wurde zurückgesetzt auf eine unverbindliche Anfrage.",
                    "Reserviert": "Ihre Anfrage wurde akzeptiert.",
                    "Bezahlt": "Ihre Reservierung wurde als bezahlt markiert.",
                    "Abgelehnt": "Ihre Anfrage wurde abgelehnt."
                }[item.state] || "" :
                    "";
                editor.translatedMessages.messageIds.itemSavedDetails = `${msg}${msg ? "<br>" : ""}{diff}`;
                return true;
            },
        });

        editor.lodgingNames = {};
        editor.init();
    });
});

async function validateLodging(item) {
    const cfg = editor.cmsSchema["#inputDate"];
    const toSend = {
        id: item._id,
        lodging: item.lodging,
        lodgingSub: item.lodgingSub,
        displayedYear: cfg.displayedYear,
        displayedMonth: cfg.displayedMonth,
    };
    console.log("validateLodging", toSend);
    if (cfg.lastSent != toSend) {
        cfg.lastSent = toSend;
        const occ = toSend.lodging && toSend.displayedYear != null && toSend.displayedMonth != null ?
            await getOccupations(
                toSend.lodging,
                toSend.lodgingSub,
                new Date(toSend.displayedYear, toSend.displayedMonth - 1, 21),
                new Date(toSend.displayedYear, toSend.displayedMonth + 1, 7),
                toSend.id
            ) :
            { capacity: 0, occupations: [] };
        if (toSend.lodgingSub > 0 && occ.capacity >= 1) {
            occ.occupations.forEach(day => { day.count = day.count >= occ.capacity ? 1 : 0; });
            occ.capacity = 1;
        }
        editor.postMessageToDatePicker(cfg, $w, occ);
    }

    if (!item.lodging) return "Bitte zuerst eine Unterkunft wählen.";
    const valRes = await isDateOccupied(item.lodging, item.lodgingSub, item.dateFrom, item.dateTo, true, item._id);
    console.log("onCustomValidation", { valRes, item });
    if (valRes.occupied) return (
        valRes.suggestedArrival ? `Belegt. Ankunft erst ab ${valRes.suggestedArrival} Uhr möglich.` :
            valRes.suggestedDeparture ? `Belegt. Abreise bis spätestens ${valRes.suggestedDeparture} Uhr nötig.` :
                `Der Zeitraum ist in dieser Unterkunft bereits belegt.`);

    return null;
}

async function updateCostsTable(item) {
    console.log("updateCostsTable");
    const hdr = [
        "Leistung",
        { label: "Anzahl Erw.", align: "right" },
        { label: "Nächte", align: "right" },
        { label: "Einzelpreis", align: "right" },
        { label: "Gesamt", align: "right" },
    ];
    $w("#textReservationPrice").html = item ? editor.getString("{costs}", { "costs": [hdr, ...await generateCostsTable(item)] }, {}) : "";
}
