import wixData from 'wix-data';
import wixLocation from 'wix-location';

import { CmsEditor, FieldType, FilterType, FilterCombine } from 'public/cms_edit.js';
import { dateRangeToString, FormatTypesMonth, toUTC, incUTCDate, nightsBetween } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, getAllLodgingNames, generateCostsTable, generateHTMLTable } from 'backend/common.jsw';

let occupationsRange = [new Date(), new Date()]; //TODO remove
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
        //if (editor) editor._updateUiFromData(); TODO
    });

    $w("#htmlDate").onMessage(async (event) => {
        console.log("received message from #htmlDate", event.data);
        if (event.data?.selectedDates?.length == 2) {
            $w("#inputDate").value = dateRangeToString(event.data.selectedDates[0], event.data.selectedDates[1], { hour: null, minute: null });
            await editor.updateDataFromUI("#inputDate");
        }
        if (event.data?.displayedMonth && event.data?.displayedYear) {
            occupationsRange = [
                new Date(event.data.displayedYear, event.data.displayedMonth - 1, 21),
                new Date(event.data.displayedYear, event.data.displayedMonth + 1, 7)
            ];
            await syncUI();
        }
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

        // special block below only for Management site -- all above shall be identical with Guest site

        editor = new CmsEditor({
            cmsName: "guestReservations",
            dataSetName: "datasetReservations",
            onGenerateEmailOptions: async (item, emailId) => {
                return await generateHTMLTable(this.lastDiff.diffIntern, [
                    { label: "Änderung", align: "right", bold: true },
                    { label: "Von", align: "left" },
                    { label: "Nach", align: "left" },
                ]);
            },

            emailIds: {
                itemSaved: "ReservationUpdated",
                itemRemoved: "ReservationRemoved",
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
                    onParseUserInput: (value) => value ? value.split("|").map((v, i) => i == 0 ? v : Number(v ?? 0)) : ["", 0],
                    onFormatValue: (values) => Array.isArray(values) && values.length == 2 ? `${values[0]}|${values[1] ?? 0}` : "",
                    onDiffValue: async (item) => item ? await generateLodgingName(item) : "",
                    onCustomValidation: async (values) => {
                        const item = editor.ds.getCurrentItem();
                        if (!item.lodging) return "Bitte zuerst eine Unterkunft wählen.";
                        const valRes = await isDateOccupied(item.lodging, item.lodgingSub, item.dateFrom, item.dateTo, true, item._id);
                        console.log("onCustomValidation", { values, valRes, item });
                        if (valRes.occupied) return (
                            valRes.suggestedArrival ? `Belegt. Ankunft erst ab ${valRes.suggestedArrival} Uhr möglich.` :
                                valRes.suggestedDeparture ? `Belegt. Abreise bis spätestens ${valRes.suggestedDeparture} Uhr nötig.` :
                                    `Der Zeitraum ist in dieser Unterkunft bereits belegt.`);
                        return "";
                    },
                    onChanged: async () => await syncUI()
                },
                "#inputDate": {
                    fields: ["dateFrom", "dateTo"],
                    type: FieldType.DATE_RANGE,
                    required: true,
                    onChanged: async () => await syncUI()
                },
                "#inputArrivalTime": {
                    field: "dateFrom",
                    required: true,
                    type: FieldType.HOURS_OF_DATE,
                    onChanged: async () => await syncUI()
                },
                "#inputDepartureTime": {
                    field: "dateTo",
                    required: true,
                    type: FieldType.HOURS_OF_DATE,
                    onChanged: async () => await syncUI()
                },
                "#inputAdults": {
                    field: "cntAdults",
                    type: FieldType.NUMBER,
                    required: true,
                    onChanged: async () => await updateCostsTable()
                },
                "#inputChildren": {
                    field: "cntChildren",
                    type: FieldType.NUMBER,
                    required: true,
                    onChanged: async () => await updateCostsTable()
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
                    type: FieldType.BOOLEAN
                },
                "#inputDeposit": {
                    field: "deposit",
                    type: FieldType.MULTI_SELECT,
                    onChanged: async () => await updateCostsTable()
                },
                "#inputPaidSum": {
                    field: "paidSum",
                    type: FieldType.NUMBER,
                    onChanged: async () => await updateCostsTable(),
                    fractionDigits: 2,
                    suffix: "€"
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
                    value: () => incUTCDate(new Date(), 1),
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

            onRefreshUI: async (item) => {
                await syncUI();
                postMessageToDatePicker({ utcDates: item.dateFrom && item.dateTo ? [new Date(item.dateFrom), new Date(item.dateTo)] : [null, null] });
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
                await syncUI();
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

async function updateCostsTable() {
    const item = editor.ds.getCurrentItem();
    $w("#textReservationPrice").html = item ?
        await generateHTMLTable((await generateCostsTable(item)), [
            "Leistung",
            { label: "Anzahl Erw.", align: "right" },
            { label: "Nächte", align: "right" },
            { label: "Einzelpreis", align: "right" },
            { label: "Gesamt", align: "right" },
        ]) : "";
}

function postMessageToDatePicker(message) {
    console.log("postMessage to #htmlDate", message);
    $w("#htmlDate").postMessage(message);
}

async function syncUI() {
    console.log("syncUI");
    const item = editor.ds.getCurrentItem();
    if (!item) return;

    await updateCostsTable();

    const occ = item.lodging ? await getOccupations(item.lodging, item.lodgingSub, new Date(occupationsRange[0]), new Date(occupationsRange[1]), item._id) : { capacity: 0, occupations: [] };
    if (item.lodgingSub > 0 && occ.capacity >= 1) {
        occ.occupations.forEach(day => { day.count = day.count >= occ.capacity ? 1 : 0; });
        occ.capacity = 1;
    }
    postMessageToDatePicker({ capacity: occ.capacity, occupations: occ.occupations });
}
