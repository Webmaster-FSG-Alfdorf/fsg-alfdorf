import wixData from 'wix-data';
import wixLocation from 'wix-location';

import { CmsEditor, FieldType, FilterType, FilterCombine } from 'public/cms_edit.js';
import { dateRangeToString, FormatTypesMonth, incUTCDate, nightsBetween } from 'public/cms.js';
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
        $w("#filterLodging").options = [{ label: "(Alle)", value: "*" }, ...options];
    });

    $w("#datasetReservations").onReady(async () => {
        console.log("#datasetReservations onReady");

        const query = wixLocation.query;
        if (query.lodging) {
            $w("#inputLodging").value = query.lodging;
            await $w("#datasetReservations").setFieldValue("lodging", query.lodging);
            $w("#inputLodging").scrollTo()
        }

        wixData.query("pricesVisitor").ascending("order").find().then((results) => {
            let options = [];
            results.items.forEach((pv) => {
                if (pv.depositName) options.push({ label: pv.title, value: pv.depositName });
            });
            $w("#inputDeposit").options = options;
        });

        const curUTC = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0));

        editor = new CmsEditor({
            cmsName: "guestReservations",
            dataSetName: "datasetReservations",

            itemSelector: $w("#itemSelector"),
            textResponse: $w("#textResponse"),
            buttonSave: $w("#buttonSave"),
            buttonRevert: $w("#buttonRevert"),
            buttonNew: $w("#buttonNew"),
            buttonRemove: $w("#buttonRemove"),
            buttonPrev: $w("#buttonPrev"),
            buttonNext: $w("#buttonNext"),

            messages: {
                itemSaved: { emailId: "ReservationUpdated", customizableMail: true },
                itemRemoved: { emailId: "ReservationRemoved", customizableMail: true },
            },

            translatedMessages: {
                itemName: "Reservierung",
                itemRemoved: "Die Reservierungsanfrage wurde storniert.",
            },

            cmsSchema: {
                "#inputState": {
                    field: "state",
                    type: FieldType.STRING,
                    required: true,
                },
                "#inputLodging": {
                    fields: ["lodging", "lodgingSub"],
                    type: FieldType.CUSTOM,
                    required: true,
                    onParseCustomUserInput: (value) => value ? value.split("|").map((v, i) => i == 0 ? v : Number(v ?? 0)) : ["", 0],
                    onFormatCustomValue: (values) => Array.isArray(values) && values.length == 2 ? `${values[0]}|${values[1] ?? 0}` : "",
                    onPrintValue: (item) => item?.lodgingName ?? "",
                    onCustomValidation: async (item) => await validateLodging(item),
                    onChanged: async (item) => {
                        if (item) item.lodgingName = await generateLodgingName(item);
                        await updateCostsTable(item);
                    }
                },
                "#inputDate": {
                    fields: ["dateFrom", "dateTo"],
                    type: FieldType.DATE_RANGE,
                    datePicker: "#htmlDate",
                    required: true,
                    minAllowed: incUTCDate(curUTC, -31),
                    maxAllowed: incUTCDate(curUTC, 62),
                    onDisplayedDateChanged: async () => await validateLodging(editor.ds.getCurrentItem()),
                    onChanged: async (item) => await updateCostsTable(item)
                },
                "#inputArrivalTime": {
                    field: "dateFrom",
                    required: true,
                    type: FieldType.HOURS_OF_DATE,
                },
                "#inputDepartureTime": {
                    field: "dateTo",
                    required: true,
                    type: FieldType.HOURS_OF_DATE,
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
                    type: FieldType.STRING
                },
                "#inputLastName": {
                    field: "lastName",
                    type: FieldType.STRING
                },
                "#inputMail": {
                    field: "email",
                    type: FieldType.STRING,
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
                    type: FieldType.BOOLEAN
                },
                "#inputDeposit": {
                    field: "deposit",
                    type: FieldType.MULTI_SELECT,
                    onChanged: async (item) => await updateCostsTable(item)
                },
                "#inputPaidSum": {
                    field: "paidSum",
                    type: FieldType.NUMBER,
                    onChanged: async (item) => await updateCostsTable(item),
                    fractionDigits: 2,
                    onPrintedValue: (res) => res + "€",
                },
                "#inputPaidSumup": {
                    field: "paidSumup",
                    type: FieldType.STRING,
                    showToUser: false
                },
                "#inputComment": {
                    field: "comment",
                    type: FieldType.STRING,
                    showToUser: false
                },
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
                    combine: FilterCombine.OR,
                    fields: ["cntAdults", "cntChildren", "paidSum", "lodgingSub"],
                    skip: (val) => val === "" || val == null || isNaN(Number(val)),
                    value: (val) => Number(val)
                },
                "#filterAlsoPast": {
                    type: FilterType.GE,
                    skip: (val) => val, // only apply if not checked
                    value: incUTCDate(new Date(), 1),
                    field: "dateTo",
                },
                "#filterStatus": {
                    type: FilterType.EQ,
                    field: "state"
                },
                "#filterLodging": {
                    type: FilterType.EQ,
                    combine: FilterCombine.PARALLEL_AND,
                    value: (val) => val.split("|").map((v, i) => i == 0 ? v : Number(v ?? 0)),
                    fields: ["lodging", "lodgingSub"],
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
    $w("#textReservationPrice").html = editor.getString("{costs}", item, { "costs": [hdr, ...await generateCostsTable(item)] }, {})
}
