import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

import { CmsEditor } from 'public/cms_edit.js';
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
        for (const lodging of results.items) if (lodging.capacity > 1) {
            for (let index = 1; index <= lodging.capacity; index++) options.push({
                label: await generateLodgingName({ lodging: lodging.lodgingID, capacityPrefix: lodging.capacityPrefix, lodgingSub: index }),
                value: `${lodging.lodgingID}|${index}`
            });
            $w("#inputLodging").options = options;
        }
        updateCostsTable();
        updateOccupations();
    });

    $w("#datasetGuestReservations").onReady(async () => {
        console.log("#datasetGuestReservations onReady");
        const dt = toUTC(new Date());
        dt.setUTCHours(0, 0, 0);
        const msg = { minDate: new Date(dt), maxDate: incUTCDate(dt, 365) };
        console.log("postMessage {minDate:", debugStr(msg.minDate), ", maxDate:", debugStr(msg.maxDate), "}");
        $w("#htmlDate").postMessage(msg);

        const query = wixLocation.query;
        if (query.lodging) {
            $w("#inputLodging").value = query.lodging;
            await $w("#datasetGuestReservations").setFieldValue("lodging", query.lodging);
            $w("#inputLodging").scrollTo()
        }

        $w("#htmlDate").onMessage(async (event) => {
            console.log("received message", event.data);
            if (event.data && Array.isArray(event.data.selectedDates) && event.data.selectedDates.length == 2) {
                await updateDateKeepingHours(event.data.selectedDates);
                updateOccupations();
                updateCostsTable();
            }
            if (event.data && event.data.displayedMonth && event.data.displayedYear) {
                occupationsRange = [
                    new Date(event.data.displayedYear, event.data.displayedMonth - 1, 21),
                    new Date(event.data.displayedYear, event.data.displayedMonth + 1, 7)
                ];
                updateOccupations(false);
            }
        });

        $w("#inputLodging").onChange(async () => {
            console.log("#inputLodging onChange");
            const lodging = $w("#inputLodging").value.split("|");
            await $w("#datasetGuestReservations").setFieldValue("lodging", lodging[0]);
            await $w("#datasetGuestReservations").setFieldValue("lodgingSub", Number(lodging[1]));
            updateOccupations();
            updateCostsTable();
        })

        $w("#inputAdults").onChange(async () => {
            console.log("#inputAdults onChange");
            updateCostsTable();
        })

        $w("#inputArrivalTime").onChange(() => {
            console.log("#inputArrivalTime onChange");
            updateHoursKeepingDate("dateFrom", Number($w("#inputArrivalTime").value));
        })

        $w("#inputDepartureTime").onChange(() => {
            console.log("#inputDepartureTime onChange");
            updateHoursKeepingDate("dateTo", Number($w("#inputDepartureTime").value));
        })

        $w("#inputDate").onKeyPress(async (event) => {
            if (event.key == "Enter") {
                console.log("#inputDate onKeyPress Enter", $w("#inputDate").value);
                await updateDateKeepingHours(stringToDateRange($w("#inputDate").value));
                updateDatePicker();
                updateOccupations();
                updateCostsTable();
            }
        });
        $w("#inputDate").onBlur(async () => {
            console.log("#inputDate onBlur", $w("#inputDate").value);
            await updateDateKeepingHours(stringToDateRange($w("#inputDate").value));
            updateDatePicker();
            updateOccupations();
            updateCostsTable();
        });

        $w("#inputPhone").onBlur(() => {
            $w("#buttonPhone").link = `tel:${$w("#inputPhone").value}`
        });
        $w("#inputPhone").onInput(() => {
            $w("#buttonPhone").link = `tel:${$w("#inputPhone").value}`
        });
        $w("#inputMail").onBlur(() => {
            $w("#buttonSendMail").link = `mailto:${$w("#inputMail").value}`
        });
        $w("#inputMail").onInput(() => {
            $w("#buttonSendMail").link = `mailto:${$w("#inputMail").value}`
        });

        $w("#inputDate").onCustomValidation((value, reject) => { if (currentDateOccupied) reject(currentDateOccupied); });
        $w("#inputArrivalTime").onCustomValidation((value, reject) => { if (currentDateOccupied.includes("Ankunft")) reject(currentDateOccupied); });
        $w("#inputDepartureTime").onCustomValidation((value, reject) => { if (currentDateOccupied.includes("Abreise")) reject(currentDateOccupied); });

        // special block below only for Management site -- all above shall be identical with Guest site

        editor = new CmsEditor({
            cmsName: "guestReservations",
            dataSetName: "datasetGuestReservations",

            refreshUI: async () => {
                editor.updateSelectorList();
                updateDatePicker();
                updateAllInputs();
                await updateOccupations();
                updateCostsTable();
            },

            generateTitle: generateTitle,

            onBeforeSave: async () => { return prepareSave(); },

            onAfterSave: (diffData) => {
                const item = $w("#datasetGuestReservations").getCurrentItem();

                if (diffData && diffData.diff.length > 0) {
                    wixWindow.openLightbox("CMSSuccessLightbox", {
                        msg: "Änderungen wurden gespeichert",
                        item,
                        diff: diffData.diff,
                        diffUser: diffData.diffUser,
                        customMessage: diffData.customMessage
                    });
                }
                cloneItem(item);
            },

            onAfterReverted: () => {
                wixWindow.openLightbox("CMSSuccessLightbox", { msg: "Änderungen wurden zurückgesetzt" });
                cloneItem($w("#datasetGuestReservations").getCurrentItem());
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
        $w("#inputDeposit").onChange(() => updateCostsTable());
        $w("#inputPaidSum").onInput(() => updateCostsTable());
        $w("#inputPaidSum").onBlur(() => updateCostsTable());

        cloneItem($w("#datasetGuestReservations").getCurrentItem());

        // end special block
    });
});

/**
 * init, loaded TODO, item-changed (setFilter), reverted, removed, new, saved -> updateCostsTable, updateOccupations, updateDatePicker, updateAllInputs == refreshUI
 * input-lodging.changed -> updateCostsTable, updateOccupations, setField item.lodging, setField item.lodgingSub
 * input-date.changed -> updateCostsTable, updateOccupations, updateDatePicker, setField item.dateFrom, setField item.dateTo
 * datepicker.changed -> updateCostsTable, updateOccupations, inputs-date.update, setField item.dateFrom, setField item.dateTo
 * datepicker.current-month -> updateOccupations(false)
 * input-arrival-time.changed -> setField item.dateFrom
 * input-departure-time.changed -> setField item.dateTo
 * input-cnt-adults.changed -> updateCostsTable
 * input-deposit.changed -> updateCostsTable
 * input-price-paid.changed -> updateCostsTable
 */

function updateAllInputs() {
    const item = $w("#datasetGuestReservations").getCurrentItem();

    console.log("updateAllInputs", item?._id, "lodging", item?.lodging, item?.lodgingSub, debugStr(item?.dateFrom), "to", debugStr(item?.dateTo));

    if (item) {
        $w("#inputLodging").value = `${item.lodging}|${item.lodgingSub ?? 0}`;
        $w("#inputDate").value = dateRangeToString(item.dateFrom, item.dateTo, { hour: null, minute: null });
        $w("#inputArrivalTime").value = toLocal(item.dateFrom).getHours().toString();
        $w("#inputDepartureTime").value = toLocal(item.dateTo).getHours().toString();
    } else {
        $w("#inputLodging").value = "";
        $w("#inputDate").value = "";
        $w("#inputArrivalTime").selectedIndex = 0;
        $w("#inputDepartureTime").selectedIndex = 0;
    }
    $w("#inputLodging").resetValidityIndication();
    $w("#inputDate").resetValidityIndication();
    $w("#inputArrivalTime").resetValidityIndication();
    $w("#inputDepartureTime").resetValidityIndication();

    //TODO update deposit list: list only items that are part of lodging

    $w("#buttonPhone").link = `tel:${$w("#inputPhone").value}`;
    $w("#buttonSendMail").link = `mailto:${$w("#inputMail").value}`;
}

function makeValidDate(d, defaultDate = new Date()) {
    if (!d) return defaultDate;
    const date = new Date(d);
    return isNaN(date.getTime()) ? defaultDate : date;
}

function updateDatePicker() {
    const item = $w("#datasetGuestReservations").getCurrentItem();
    const dateFrom = makeValidDate(item?.dateFrom);
    const dateTo = makeValidDate(item?.dateTo);
    const msg = { utcDates: [dateFrom, dateTo] };
    console.log("updateOccupations", "postMessage utcDates: {", debugStr(msg.utcDates[0]), ",", debugStr(msg.utcDates[1]), "}");
    $w("#htmlDate").postMessage(msg);
}

async function updateHoursKeepingDate(field, hours) {
    const utcDate = $w("#datasetGuestReservations").getCurrentItem()[field];
    let dt = new Date(utcDate);
    dt.setUTCHours(0, 0, 0, 0);
    dt = toLocal(dt);
    dt.setHours(hours, 0, 0, 0);
    await $w("#datasetGuestReservations").setFieldValue(field, toUTC(dt));
}

async function updateDateKeepingHours(utcDateRange) {
    const item = $w("#datasetGuestReservations").getCurrentItem();

    const dtFrom = makeValidDate(utcDateRange[0], new Date(0));
    let hours = item ? new Date(item.dateFrom).getUTCHours() : 0;
    dtFrom.setUTCHours(isNaN(hours) ? 0 : hours, 0, 0, 0);
    await $w("#datasetGuestReservations").setFieldValue("dateFrom", dtFrom);

    const dtTo = makeValidDate(utcDateRange[1], new Date(0));
    hours = item ? new Date(item.dateTo).getUTCHours() : 0;
    dtTo.setUTCHours(isNaN(hours) ? 0 : hours, 0, 0, 0);
    await $w("#datasetGuestReservations").setFieldValue("dateTo", dtTo);

    console.log("updateDateKeepingHours", item?._id, dtFrom, dtTo);
    $w("#inputDate").value = dateRangeToString(dtFrom, dtTo, { hour: null, minute: null });
}

function updateCostsTable() {
    const item = $w("#datasetGuestReservations").getCurrentItem();
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
}

async function updateOccupations(currentDateOccupiedUpdate = true) { //TODO split into two functions?
    const item = $w("#datasetGuestReservations").getCurrentItem();

    if (currentDateOccupiedUpdate) {
        if (item == null)
            currentDateOccupied = ""
        else if (!item.lodging) {
            // would just return {occupied: true} anyway
            currentDateOccupied = "Bitte zuerst eine Unterkunft wählen.";
        } else try {
            const res = await isDateOccupied(item.lodging, item.lodgingSub, item.dateFrom, item.dateTo, true, item._id);
            if (!res.occupied)
                currentDateOccupied = "";
            else if (res.suggestedArrival)
                currentDateOccupied = `Nur möglich bei Ankunfts-Zeit nach ${res.suggestedArrival} Uhr`;
            else if (res.suggestedDeparture)
                currentDateOccupied = `Nur möglich bei Abreise-Zeit bis ${res.suggestedDeparture} Uhr`;
            else
                currentDateOccupied = "Ihr gewählter Datumsbereich ist leider nicht verfügbar";
        } catch (err) {
            currentDateOccupied = `Verfügbarkeit kann leider aktuell nicht geprüft werden: ${err}`;
        }
        console.log("updateOccupations currentDateOccupied =", currentDateOccupied);
    }
    $w("#inputDate").resetValidityIndication();
    $w("#inputArrivalTime").resetValidityIndication();
    $w("#inputDepartureTime").resetValidityIndication();

    let oc = [];
    if (item) try {
        oc = await getOccupations(item.lodging, item.lodgingSub, new Date(occupationsRange[0]), new Date(occupationsRange[1]), item._id);
        if (item.lodgingSub > 0 && oc.capacity >= 1) {
            // report only capacity 0 and 1 for sub lodgings
            oc.occupations.forEach((/** @type {{ count: number; capacity: number; }} */ oc) => { oc.count = oc.count >= oc.capacity ? 1 : 0; });
            oc.capacity = 1;
        }
    } catch (err) {
        oc.capacity = 0;
        oc.occupations = [];
    }
    console.log("updateOccupations", "postMessage", oc);
    $w("#htmlDate").postMessage({ capacity: oc.capacity, occupations: oc.occupations });
}

// special block below only for Management site -- all above shall be identical with Guest site

function generateTitle(item) {
    if (item && (item.dateFom || item.dateTo || item.lastName || item.lodging)) {
        const startDate = dateRangeToString(item.dateFrom, null, { month: FormatTypesMonth.short, weekday: null, hour: null, minute: null });
        const nights = `+${nightsBetween(item.dateFrom, item.dateTo)}N`;
        return `${startDate} ${nights} ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub > 0 ? item.lodgingSub : ""}`.trim();
    } else
        return "(Neue Reservierung)";
}

function cloneItem(item) {
    originalItem = item ? structuredClone(item) : null;
    console.log("originalItem now is", originalItem);
}

async function doQueryUpdate(searchText) {
    console.log(`doQueryUpdate ${searchText}`);
    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // ignore empty entries
    let q = wixData.query("guestReservations").isNotEmpty("searchField").descending("_updatedDate").limit(1000);

    if (!$w('#filterAlsoPast').checked) q = q.ge("dateTo", incUTCDate(new Date(), 1));

    const status = $w("#filterStatus").value;
    console.log(`doQueryUpdate status ${status}`);
    if (status != "*") q = q.eq("state", status);

    const lodging = $w("#filterLodging").value;
    console.log(`doQueryUpdate lodging ${lodging}`);
    if (lodging) { const [l, ls] = lodging.split("|"); q = q.and(wixData.query("guestReservations").eq("lodging", l).eq("lodgingSub", Number(ls))); }

    const s = normalize(searchText).trim();
    console.log(`doQueryUpdate ${JSON.stringify(q)} ${s}`);
    if (s) {
        const sn = Number(s);
        if (s == sn.toString()) { // user entered a number
            let qOr = wixData.query("guestReservations").eq("cntAdults", sn);
            ["cntChildren", "paidSum", "lodgingSub"].forEach(f => { qOr = qOr.or(wixData.query("guestReservations").eq(f, sn)); });
            q = q.and(qOr);
        } else // user entered a string
            q = q.contains("searchField", s);
    }

    console.log(`doQueryUpdate ${JSON.stringify(q)}`);
    try {
        const res = await q.find();
        console.log(`doQueryUpdate ${JSON.stringify(res)}`);
        return res.items;
    } catch (err) {
        console.error("Query failed", err);
        return [];
    }
}

async function prepareSave() {
    const item = $w("#datasetGuestReservations").getCurrentItem();

    let diff = [];
    let diffUser = [];
    let customMessage = "";
    const diffField = (label, v1, v2, showUser = true) => {
        if (v1 != v2) {
            diff.push([label, v1, v2]);
            if (showUser) diffUser.push([label, v1, v2]);
        }
    };

    if (originalItem && item) {
        diffField("Status", originalItem.state, item.state);
        if (originalItem.state !== item.state) customMessage = {
            "Anfrage": "Der Status wurde zurückgesetzt auf eine unverbindliche Anfrage.",
            "Reserviert": "Ihre Anfrage wurde akzeptiert.",
            "Bezahlt": "Ihre Reservierung wurde als bezahlt markiert.",
            "Abgelehnt": "Ihre Anfrage wurde abgelehnt."
        }[item.state] || customMessage;
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

        diffField("Bezahlt", `${originalItem.paidSum?.toFixed(2) ?? "0.00"} €`, `${item.paidSum?.toFixed(2) ?? "0.00"} €`);

        diffField("SumupID", originalItem.paidSumup, item.paidSumup, false);

        diffField("Interner Kommentar", originalItem.comment, item.comment, false);
    }

    console.log("save", item?._id, "diff:", diff);

    return { diff, diffUser, customMessage };
}
