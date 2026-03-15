import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

import { CmsEditor, FieldType } from 'public/cms_edit.js';
import { dateRangeToString, FormatTypesMonth, stringToDateRange, toUTC, toLocal, debugStr, incUTCDate, nightsBetween } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, generateCostsTable, generateHTMLTable } from 'backend/common.jsw';

let currentDateOccupied = "";
let occupationsRange = [new Date(), new Date()];
let originalItem = null;
let editor;

$w.onReady(function () {
    wixData.query("lodgings").ascending("order").find().then(async (results) => {
        let options = [];
        // main lodgings go first
        results.items.forEach((lodging) => {
            options.push({ label: lodging.title, value: `${lodging.lodgingID}|0` });
        });
        // then all sub lodgings
        const subPromises = [];
        for (const lodging of results.items) if (lodging.capacity > 1)
            for (let index = 1; index <= lodging.capacity; index++) subPromises.push(
                generateLodgingName({
                    lodging: lodging.lodgingID,
                    capacityPrefix: lodging.capacityPrefix,
                    lodgingSub: index
                }).then(name => ({ label: name, value: `${lodging.lodgingID}|${index}` }))
            );
        const subOptions = await Promise.all(subPromises);
        options.push(...subOptions);
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
                "#inputState": { field: "state", type: FieldType.STRING, label: "Status" },
                "#inputLodging": {
                    field: ["lodging", "lodgingSub"], type: FieldType.STRING, label: "XXX", resetValidityIndication: true,
                    onParseUserInput: (input) => {
                        const lodging = input.split("|");
                        return [lodging[0], Number(lodging[1] || 0)];
                    },
                    onFormatValue: (item) => item && item.lodging ? `${item.lodging}|${item.lodgingSub ?? 0}` : "",
                    onChanged: () => syncUI(true, false)
                },
                "#inputDate": {
                    field: ["dateFrom", "dateTo"], type: FieldType.DATE, label: "XXX", resetValidityIndication: true,
                    onChanged: () => syncUI(true, false)
                },
                "#inputArrivalTime": { field: "dateFrom", type: FieldType.HOURS_OF_DATE, label: "XXX", resetValidityIndication: true, onChanged: () => syncUI(true, false) },
                "#inputDepartureTime": { field: "dateTo", type: FieldType.HOURS_OF_DATE, label: "XXX", resetValidityIndication: true, onChanged: () => syncUI(true, false) },
                "#inputAdults": { field: "cntAdults", type: FieldType.NUMBER, label: "Erwachsene", onChanged: () => updateCostsTable() },
                "#inputChildren": { field: "cntChildren", type: FieldType.NUMBER, label: "Kinder", onChanged: () => updateCostsTable(), fractionDigits: 3 },
                "#inputFirstName": { field: "firstName", type: FieldType.STRING, label: "Vorname" },
                "#inputLastName": { field: "lastName", type: FieldType.STRING, label: "Nachnachme" },
                "#inputMail": { field: "email", type: FieldType.STRING, label: "E-Mail", linkButton: "#buttonSendMail", linkPrefix: "mailto:" },
                "#inputPhone": { field: "phoneNumber", type: FieldType.STRING, label: "Telefonnummer", linkButton: "#buttonPhone", linkPrefix: "tel:" },
                "#inputAddress": { field: "address", type: FieldType.ADDRESS, label: "Addresse" },
                "#inputNotes": { field: "notes", type: FieldType.STRING, label: "Hinweise des Gastes" },
                "#inputPrivacyPolicy": { field: "privacyPolicy", type: FieldType.BOOLEAN, label: "Datenschutz akzeptiert" },
                "#inputDeposit": { field: "deposit", type: FieldType.MULTI_SELECT, label: "Pfand/Kaution", onChanged: () => updateCostsTable() },
                "#inputPaidSum": { field: "paidSum", type: FieldType.NUMBER, label: "Bezahlt", onChanged: () => updateCostsTable() },
                "#inputPaidSumup": { field: "paidSumup", type: FieldType.STRING, label: "Sumup ID" },
                "#inputComment": { field: "comment", type: FieldType.STRING, label: "Interner Kommentar" },
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
                    return false;
                }
                return prepareSave();
            },

            onAfterSave: (diffData) => {
                const item = editor.ds.getCurrentItem();
                if (diffData && diffData.diff.length > 0)
                    wixWindow.openLightbox("CMSSuccessLightbox", {
                        msg: "Änderungen wurden gespeichert",
                        item,
                        diff: diffData.diff,
                        diffUser: diffData.diffUser,
                        customMessage: diffData.customMessage
                    });
                cloneItem(item);
            },

            onAfterReverted: () => {
                wixWindow.openLightbox("CMSSuccessLightbox", { msg: "Änderungen wurden zurückgesetzt" });
                cloneItem(editor.ds.getCurrentItem());
            },

            onAfterDelete: (deletedItem) => {
                wixWindow.openLightbox("CMSSuccessLightbox", {
                    msg: "Reservierung wurde gelöscht",
                    item: deletedItem,
                    customMessage: "Ihre Reservierungsanfrage wurde storniert."
                });
                cloneItem(null);
            },

            onQueryUpdate: doQueryUpdate
        });

        editor.init();

        $w("#filterAlsoPast").onChange(() => editor.updateSelectorList());
        $w("#filterStatus").onChange(() => editor.updateSelectorList());
        $w("#filterLodging").onChange(() => editor.updateSelectorList());

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

function cloneItem(item) {
    originalItem = item ? structuredClone(item) : null;
    console.log("originalItem now is", originalItem);
}

async function doQueryUpdate(searchText) {
    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // ignore empty entries
    let q = wixData.query("guestReservations").isNotEmpty("searchField").descending("_updatedDate").limit(1000);

    if (!$w('#filterAlsoPast').checked) q = q.ge("dateTo", incUTCDate(new Date(), 1));

    const status = $w("#filterStatus").value;
    if (status && status != "*") q = q.eq("state", status);

    const lodging = $w("#filterLodging").value;
    if (lodging && lodging != "*") { const [l, ls] = lodging.split("|"); q = q.and(wixData.query("guestReservations").eq("lodging", l).eq("lodgingSub", Number(ls))); }

    const s = normalize(searchText).trim();
    if (s) {
        const sn = Number(s);
        if (s == sn.toString()) { // user entered a number
            let qOr = wixData.query("guestReservations").eq("cntAdults", sn);
            ["cntChildren", "paidSum", "lodgingSub"].forEach(f => { qOr = qOr.or(wixData.query("guestReservations").eq(f, sn)); });
            q = q.and(qOr);
        } else // user entered a string
            q = q.contains("searchField", s);
    }

    console.log(`doQueryUpdate query:\n${JSON.stringify(q, null, 2)}`);
    try {
        const res = await q.find();
        return res.items;
    } catch (err) {
        console.error("Query failed", err);
        return [];
    }
}

async function prepareSave() {
    const item = editor.ds.getCurrentItem();

    let diffUser = editor.getDiff(originalItem);
    let diff = [...diffUser];

    let customMessage = "";
    /*
    if (originalItem.state !== item.state) customMessage = {
        "Anfrage": "Der Status wurde zurückgesetzt auf eine unverbindliche Anfrage.",
        "Reserviert": "Ihre Anfrage wurde akzeptiert.",
        "Bezahlt": "Ihre Reservierung wurde als bezahlt markiert.",
        "Abgelehnt": "Ihre Anfrage wurde abgelehnt."
    }[item.state] || customMessage;

    TODO
    
        let diff = [];
        let diffUser = [];
        const diffField = (label, v1, v2, showUser = true) => {
            if (v1 != v2) {
                diff.push([label, v1, v2]);
                if (showUser) diffUser.push([label, v1, v2]);
            }
        };
    
        if (originalItem && item) {
            diffField("Status", originalItem.state, item.state);
            diffField("Unterkunft", await generateLodgingName(originalItem), await generateLodgingName(item))
    
            diffField("Datum",
                dateRangeToString(originalItem.dateFrom, originalItem.dateTo, { hour: null, minute: null }),
                dateRangeToString(item.dateFrom, item.dateTo, { hour: null, minute: null })
            );
    
            const av0 = toLocal(originalItem.dateFrom).getHours().toString();
            const av1 = toLocal(item.dateFrom).getHours().toString();
            diffField("Ankunft ab",
                $w("#inputArrivalTime").options.find(o => o.value == av0)?.label,
                $w("#inputArrivalTime").options.find(o => o.value == av1)?.label
            );
    
            const dp0 = toLocal(originalItem.dateTo).getHours().toString();
            const dp1 = toLocal(item.dateTo).getHours().toString();
            diffField("Abreise bis",
                $w("#inputDepartureTime").options.find(o => o.value == dp0)?.label,
                $w("#inputDepartureTime").options.find(o => o.value == dp1)?.label
            );
    
            diffField("Erwachsene", originalItem.cntAdults, item.cntAdults);
    
            diffField("Kinder", originalItem.cntChildren, item.cntChildren);
    
            diffField("Name", `${originalItem.firstName} ${originalItem.lastName}`, `${item.firstName} ${item.lastName}`);
    
            diffField("E-Mail", originalItem.email, item.email);
    
            diffField("Telefonnummer", originalItem.phoneNumber, item.phoneNumber);
    
            diffField("Adresse", originalItem.address?.formatted, item.address?.formatted);
    
            diffField("Hinweise", originalItem.notes, item.notes);
    
            diffField("Datenschutzerklärung", originalItem.privacyPolicy ? "Ja" : "Nein", item.privacyPolicy ? "Ja" : "Nein");
    
            diffField("Pfand/Kaution", originalItem.deposit?.toString() ?? "", item.deposit?.toString() ?? "");
    
            diffField("Bezahlt", `${Number(originalItem.paidSum || 0).toFixed(2) ?? "0.00"} €`, `${Number(item.paidSum || 0).toFixed(2) ?? "0.00"} €`);
    
            diffField("SumupID", originalItem.paidSumup, item.paidSumup, false);
    
            diffField("Interner Kommentar", originalItem.comment, item.comment, false);
        }
        */

    console.log("save", item?._id, "diff:", diff);

    return { diff, diffUser, customMessage };
}
