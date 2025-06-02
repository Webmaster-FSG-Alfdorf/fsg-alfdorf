import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

import { dateRangeToString, stringToDateRange, toUTC, toLocal, debugStr, incUTCDate, nightsBetween } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, generateCostsTable, generateHTMLTable } from 'backend/common.jsw';

let currentDateOccupied = "";
let occupationsRange = [new Date(), new Date()];
let originalItem = null;

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
        const msg = { minDate: new Date(), maxDate: incUTCDate(new Date(), 365) };
        console.log("postMessage", msg);
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
                updateDateKeepingHours(event.data.selectedDates);
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

        updateAll();

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
                console.log("#inputDate onKeyPress Enter");
                updateDateKeepingHours(stringToDateRange($w("#inputDate").value));
                updateOccupations();
                updateCostsTable();
                updateDatePicker();
            }
        });
        $w("#inputDate").onBlur(async () => {
            console.log("#inputDate onBlur");
            updateDateKeepingHours(stringToDateRange($w("#inputDate").value));
            updateOccupations();
            updateCostsTable();
            updateDatePicker();
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

        $w("#datasetGuestReservations").onAfterSave(async () => {
            console.log("#datasetGuestReservations onAfterSave");
            updateAll();
        });

        // special block below only for Management site -- all above shall be identical with Guest site

        updateFilter();
        $w("#filterSearch").onKeyPress((event) => { if (event.key == "Enter") updateFilter(); });
        $w("#filterSearch").onBlur(() => { updateFilter() });
        $w("#buttonFilter").onClick(() => { updateFilter() });

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

        $w("#dropdownFilterResultsMore").onChange(() => { setCurrentFilter($w("#dropdownFilterResultsMore").value); });

        $w("#buttonSave").onClick(() => save());
        $w("#buttonRevert").onClick(() => revert());
        $w("#buttonRemove").onClick(() => remove());
        $w("#buttonNew").onClick(() => save(() => {
            console.log("#buttonNew onClick add()");
            $w("#datasetGuestReservations").add().then(async () => {
                console.log("#buttonNew onClick add() then");
                updateAll();
            });
        }));
        $w("#buttonPrev").onClick(() => {
            console.log("#buttonPrev onClick");
            const curID = $w("#datasetGuestReservations").getCurrentItem()?._id;
            const i = curID ? sortedResults.indexOf(curID) : -1;
            if (i > 0) setCurrentFilter(sortedResults[i - 1]);
        });
        $w("#buttonNext").onClick(() => {
            console.log("#buttonNext onClick");
            const curID = $w("#datasetGuestReservations").getCurrentItem()?._id;
            const i = curID ? sortedResults.indexOf(curID) : -1;
            if (i != -1 && i < sortedResults.length - 1) setCurrentFilter(sortedResults[i + 1]);
        });

        cloneItem(null); //TODO or current Item?

        // end special block
    });
});

/**
 * init, loaded TODO, item-changed (setFilter), reverted, removed, new, saved -> updateCostsTable, updateOccupations, updateDatePicker, updateAllInputs == updateAll
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
async function updateAll() {
    updateOccupations();
    updateCostsTable();
    updateDatePicker();
    updateAllInputs();
    updateTitle();
}

async function updateAllInputs() {
    const item = $w("#datasetGuestReservations").getCurrentItem();

    console.log("updateAllInputs", item?._id, "lodging", item?.lodging, item?.lodgingSub, debugStr(item?.dateFrom), "to", debugStr(item?.dateTo));

    if (item) {
        $w("#inputLodging").value = `${item.lodging}|${item.lodgingSub ?? 0}`;
        $w("#inputDate").value = dateRangeToString({ start: item.dateFrom, end: item.dateTo }, { hour: null, minute: null });
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

function updateDatePicker() {
    const item = $w("#datasetGuestReservations").getCurrentItem();
    if (item)
        $w("#htmlDate").postMessage({ currentDate: [new Date(item.dateFrom), new Date(item.dateTo)] });
    else
        $w("#htmlDate").postMessage({ currentDate: [new Date(), new Date()] });
}

async function updateHoursKeepingDate(field, hours) {
    const utcDate = $w("#datasetGuestReservations").getCurrentItem()[field];
    let dt = new Date(utcDate);
    dt.setUTCHours(0, 0, 0, 0);
    dt = toLocal(dt);
    dt.setHours(hours, 0, 0, 0);
    $w("#datasetGuestReservations").setFieldValue(field, toUTC(dt));
}

async function updateDateKeepingHours(utcDateRange) {
    const item = $w("#datasetGuestReservations").getCurrentItem();

    const dtFrom = new Date(utcDateRange[0] ?? new Date(0));
    dtFrom.setUTCHours(item ? new Date(item.dateFrom).getUTCHours() : 0, 0, 0, 0);
    await $w("#datasetGuestReservations").setFieldValue("dateFrom", dtFrom);

    const dtTo = new Date(utcDateRange[1] ?? new Date(0));
    dtTo.setUTCHours(item ? new Date(item.dateTo).getUTCHours() : 0, 0, 0, 0);
    await $w("#datasetGuestReservations").setFieldValue("dateTo", dtTo);

    $w("#inputDate").value = dateRangeToString({ start: dtFrom, end: dtTo }, { hour: null, minute: null });
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

    let oc = [];
    if (item) try {
        oc = await getOccupations(item.lodging, item.lodgingSub, new Date(occupationsRange[0]), new Date(occupationsRange[1]), item._id);
    } catch (err) {
        oc.capacity = 0;
        oc.occupations = [];
    }
    console.log("updateOccupations", "postMessage", oc);
    $w("#htmlDate").postMessage({ capacity: oc.capacity, occupations: oc.occupations });
}

// special block below only for Management site -- all above shall be identical with Guest site

function updateFilter() {
    const cntShownDirectly = 6;

    const searchText = $w("#filterSearch").value.trim();
    const onlyFuture = $w('#filterOnlyFuture').checked ? incUTCDate(new Date(), 1) : null;
    if (filterConditionST == searchText && filterConditionOF == onlyFuture) return;
    filterConditionOF = onlyFuture;
    filterConditionST = searchText
    console.log("updateFilter for", searchText, "onlyFuture", onlyFuture != null);

    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // ignore empty entries
    let q = wixData.query("guestReservations").isNotEmpty("searchField").descending("_updatedDate").limit(1000);
    if (onlyFuture) q = q.ge("dateTo", onlyFuture);

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

    q.find().then(async (res) => {
        const sorted = res.items;//.sort((a, b) => { return b.dateFrom - a.dateFrom; });
        sortedResults = sorted.map((i) => i._id);
        console.log("updateFilter", res.items.length, "results:", sortedResults);
        $w("#repeaterFilterResults").data = sorted.slice(0, cntShownDirectly);
        if (sorted.length > cntShownDirectly)
            $w("#dropdownFilterResultsMore").expand();
        else
            $w("#dropdownFilterResultsMore").collapse();
        $w("#dropdownFilterResultsMore").label = `Weitere (Gesamt ${sorted.length})`;
        $w("#dropdownFilterResultsMore").options = sorted.slice(cntShownDirectly).map(item => ({ label: generateTitle(item), value: item._id }));
        setTimeout(() => {
            $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
                const title = generateTitle(itemData);
                $item("#textFilterResult").text = title;
                $item("#textFilterResultActive").text = title;
                $item("#textFilterResult").onClick(() => { setCurrentFilter(itemData._id) });
            });
            updateFilterSelection();
        }, 0);
    }).catch((err) => console.error(`Cannot filter and sort data set:`, err));
}
let filterConditionOF = null;
let filterConditionST = null;
let sortedResults = [];

function setCurrentFilter(itemId) {
    if (loadingID == itemId) return;
    loadingID = itemId;
    console.log("setCurrentFilter save", itemId);
    save(() => {
        console.log("setCurrentFilter setFilter", itemId);
        $w("#datasetGuestReservations").setFilter(wixData.filter().eq('_id', itemId)).then(() => {
            loadingID = "";
            console.log("setCurrentFilter update", itemId);
            updateAll();
            updateFilterSelection();
        }).catch((err) => showError(err));
    });
}
let loadingID = "";

/**
 * Updates the selection state of the filter results based on the currently displayed item
 */
function updateFilterSelection() {
    const curID = $w("#datasetGuestReservations").getCurrentItem()?._id;
    console.log("updateFilterSelection", curID);
    $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
        if (itemData._id == curID) {
            $item("#textFilterResult").hide();
            $item("#textFilterResultActive").show();
        } else {
            $item("#textFilterResult").show();
            $item("#textFilterResultActive").hide();
        }
    });
    $w("#dropdownFilterResultsMore").value = curID ?? "";
}

function updateTitle() {
    const item = $w("#datasetGuestReservations").getCurrentItem();
    const newTitle = generateTitle(item);
    $w("#textTitle").text = newTitle;
    $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
        if (itemData._id == item?._id) {
            $item("#textFilterResult").text = newTitle;
            $item("#textFilterResultActive").text = newTitle;
        }
    });
    const opt = $w("#dropdownFilterResultsMore").options;
    for (const o of opt) {
        if (o.value == item?._id) {
            o.label = newTitle;
            $w("#dropdownFilterResultsMore").options = opt;
            break;
        }
    }
}

function generateTitle(item) {
    if (item && (item.dateFrom || item.dateTo || item.lastName || item.lodging))
        return `${dateRangeToString({ start: item.dateFrom }, { hour: null, minute: null })} +${nightsBetween(item.dateFrom, item.dateTo)}N ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub > 0 ? item.lodgingSub : ""}`.trim();
    else
        return "(Neue Reservierung)";
}

function cloneItem(item) {
    originalItem = item ? structuredClone(item) : null;
    console.log("originalItem now is", originalItem);
}

async function save(onSuccess = () => { }) {
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
            dateRangeToString({ start: originalItem.dateFrom, end: originalItem.dateTo }, { hour: null, minute: null }),
            dateRangeToString({ start: item.dateFrom, end: item.dateTo }, { hour: null, minute: null })
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

        diffField("Pfand/Kaution", originalItem.deposit.toString(), item.deposit.toString());

        diffField("Bezahlt", `${originalItem.paidSum.toFixed(2)} €`, `${item.paidSum.toFixed(2)} €`);

        diffField("SumupID", originalItem.paidSumup, item.paidSumup, false);

        diffField("Interner Kommentar", originalItem.comment, item.comment, false);
    }

    console.log("save", item?._id, "diff:", diff);

    $w("#datasetGuestReservations").save().then(() => {
        console.log("save then");
        if (diff.length > 0)
            wixWindow.openLightbox("CMSSuccessLightbox", {
                msg: "Änderungen wurden gespeichert",
                item,
                diff,
                diffUser,
                customMessage
            });
        cloneItem(item);
        onSuccess();
    }).catch(err => { showError(err) });
}

function revert(onSuccess = () => { }) {
    const item = $w("#datasetGuestReservations").getCurrentItem();
    console.log("revert", item?._id);
    $w("#datasetGuestReservations").revert().then(() => {
        console.log("revert then");
        wixWindow.openLightbox("CMSSuccessLightbox", { msg: "Änderungen wurden zurückgesetzt" });
        updateAll();
        onSuccess();
    }).catch(err => { showError(err) });
}

function remove(onSuccess = () => { }) {
    const item = $w("#datasetGuestReservations").getCurrentItem();
    console.log("remove", item?._id);
    $w("#datasetGuestReservations").remove().then(() => {
        console.log("remove then");
        wixWindow.openLightbox("CMSSuccessLightbox", {
            msg: "Reservierung wurde gelöscht",
            item,
            customMessage: "Ihre Reservierungsanfrage wurde storniert."
        });
        cloneItem(null);
        updateAll();
        onSuccess();
    }).catch(err => { showError(err) });
}

function showError(err) {
    console.log("showError", err);
    wixWindow.openLightbox("CMSErrorLightbox", { msg: err });
}