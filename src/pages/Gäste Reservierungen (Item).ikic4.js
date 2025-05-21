import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

import { dateRangeToString, stringToDateRange, toUTC, toLocal, debugStr, incUTCDate, nightsBetween } from 'public/cms.js';
import { formatReservationPrice } from 'public/guests.js';
import { getOccupations, isDateOccupied } from 'backend/common.jsw';

let currentDate = [null, null];
let currentDateOccupied = "";
let occupationsFrom = new Date();
let occupationsTo = new Date();
let originalItem = null;

$w.onReady(function () {
    wixData.query("lodgings").ascending("order").find().then((results) => {
        let options = [];
        // main lodgings go first
        results.items.forEach((lodging) => {
            options.push({ label: lodging.title, value: `${lodging.lodgingID}|0` });
        });
        // then all sub lodgings
        results.items.forEach((lodging) => {
            if (lodging.capacity > 1) {
                for (let index = 1; index <= lodging.capacity; index++)
                    options.push({ label: `${lodging.title} ${lodging.capacityPrefix} ${index}`, value: `${lodging.lodgingID}|${index}` });
            }
        });
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
                updateCurrentDate([new Date(event.data.selectedDates[0]), new Date(event.data.selectedDates[1])]);
            }
            if (event.data && event.data.displayedMonth && event.data.displayedYear) {
                occupationsFrom = new Date(event.data.displayedYear, event.data.displayedMonth - 1, 21);
                occupationsTo = new Date(event.data.displayedYear, event.data.displayedMonth + 1, 7);
                updateForm(true);
            }
        });

        updateForm(true);
        $w("#inputLodging").onChange((event) => { updateForm(true); })
        $w("#inputAdults").onChange((event) => { updateForm(true); })
        $w("#inputChildren").onChange((event) => { updateForm(true); })
        $w("#inputArrivalTime").onChange((event) => { updateForm(true); })
        $w("#inputDepartureTime").onChange((event) => { updateForm(true); })

        $w("#inputDate").onKeyPress((event) => { if (event.key === "Enter") updateCurrentDate(stringToDateRange($w("#inputDate").value)); });
        $w("#inputDate").onBlur((event) => { updateCurrentDate(stringToDateRange($w("#inputDate").value)); });

        $w("#inputDate").onCustomValidation((value, reject) => { if (currentDateOccupied) reject(currentDateOccupied); });
        $w("#inputArrivalTime").onCustomValidation((value, reject) => { if (currentDateOccupied.includes("Ankunft")) reject(currentDateOccupied); });
        $w("#inputDepartureTime").onCustomValidation((value, reject) => { if (currentDateOccupied.includes("Abreise")) reject(currentDateOccupied); });

        //$w("#datasetGuestReservations").onAfterSave(() => { updateCurrentDate([null, null]); });

        // special block below only for Management site -- all above shall be identical with Guest site

        updateFilter();
        $w("#filterSearch").onKeyPress((event) => { if (event.key === "Enter") updateFilter(); });
        $w("#filterSearch").onBlur(() => { updateFilter(); }); //FIXME called twice
        $w("#buttonFilter").onClick(() => { updateFilter(); });

        wixData.query("pricesVisitor").ascending("order").find().then((results) => {
            let options = [];
            results.items.forEach((pv) => {
                if (pv.depositName) options.push({ label: pv.title, value: pv.depositName });
            });
            $w("#inputDeposit").options = options;
        });

        $w("#dropdownFilterResultsMore").onChange(() => { //FIXME
            const nextID = $w("#dropdownFilterResultsMore").value;
            console.log("#dropdownFilterResultsMore onChange setFilter", nextID);
            save(() => { $w("#datasetGuestReservations").setFilter(wixData.filter().eq('_id', nextID)) });
        });

        updateFields();

        $w("#buttonSave").onClick(() => save());
        $w("#buttonRevert").onClick(() => revert());
        $w("#buttonRemove").onClick(() => remove());
        $w("#buttonNew").onClick(() => save(() => {
            console.log("#buttonNew onClick add()");
            $w("#datasetGuestReservations").add()
        }));
        $w("#buttonPrev").onClick(() => save(() => {
            console.log("#buttonPrev onClick previous()");
            $w("#datasetGuestReservations").previous()
        }));
        $w("#buttonNext").onClick(() => save(() => {
            console.log("#buttonNext onClick next()");
            $w("#datasetGuestReservations").next()
        }));

        // end special block
    });
});

function updateCurrentDate(cd) {
    console.log("updateCurrentDate", debugStr(cd[0]), debugStr(cd[1]));
    currentDate = cd;
    $w("#htmlDate").postMessage({ currentDate });
    $w("#inputDate").resetValidityIndication();
    updateForm(true);
}

function updateOccupiedState(s) {
    console.log("updateOccupiedState", s);
    currentDateOccupied = s;
    $w("#inputDate").resetValidityIndication();
    $w("#inputDate").value = $w("#inputDate").value; // force onCustomValidation()
    $w("#inputArrivalTime").resetValidityIndication();
    $w("#inputArrivalTime").value = $w("#inputArrivalTime").value; // force onCustomValidation()
    $w("#inputDepartureTime").resetValidityIndication();
    $w("#inputDepartureTime").value = $w("#inputDepartureTime").value; // force onCustomValidation()
}

function updateHoursAsLocal(i, id) {
    console.log("updateForm", "updateHoursAsLocal", id, "with", $w(id).value, "to", currentDate[i]);
    if (currentDate[i]) {
        let local = toLocal(currentDate[i]);
        local.setHours(+$w(id).value, 0, 0, 0);
        currentDate[i] = toUTC(local);
    }
}

/**
 * Updates currentDate based on user input from #inputArrivalTime and #inputDepartureTime.
 * 
 * Based on new currentDate and #inputLodging updates #inputDate, the price table and the currentDateOccupied state.
 * 
 * @param {boolean} updateItemFromInput if true, also updates item's fields based on currentDate and lodging.
 */
function updateForm(updateItemFromInput) {
    console.log("updateForm");
    // updateDateAndPrice
    updateHoursAsLocal(0, "#inputArrivalTime");
    updateHoursAsLocal(1, "#inputDepartureTime");

    const curID = $w("#datasetGuestReservations").getCurrentItem()._id;

    const lodging = $w("#inputLodging").value.split("|");
    if (currentDate[0] && currentDate[1]) {
        let dt0 = new Date(currentDate[0]);
        let dt1 = new Date(currentDate[1]);
        isDateOccupied(lodging[0], +lodging[1], dt0, dt1, true, curID).then((res) => {
            if (!res.occupied)
                updateOccupiedState("");
            else if (res.suggestedArrival)
                updateOccupiedState(`Nur möglich bei Ankunfts-Zeit nach ${res.suggestedArrival} Uhr`);
            else if (res.suggestedDeparture)
                updateOccupiedState(`Nur möglich bei Abreise-Zeit bis ${res.suggestedDeparture} Uhr`);
            else
                updateOccupiedState("Ihr Gewählter Datumsbereich ist leider nicht verfügbar");
        });
    } else {
        updateOccupiedState("");
    }

    formatReservationPrice(currentDate).then(html => { $w("#textReservationPrice").html = html; });

    $w("#inputDate").value = dateRangeToString({ start: currentDate[0], end: currentDate[1] }, { hour: null, minute: null });

    getOccupations(lodging[0], +lodging[1], new Date(occupationsFrom), new Date(occupationsTo), curID).then(res => {
        $w("#htmlDate").postMessage({ minDate: new Date(), maxDate: incUTCDate(new Date(), 365), capacity: res.capacity, occupations: res.occupations });
    });

    if (updateItemFromInput) { //FIXME remove if -- condition always true
        if (currentDate[0]) $w("#datasetGuestReservations").setFieldValue("dateFrom", currentDate[0]);
        if (currentDate[1]) $w("#datasetGuestReservations").setFieldValue("dateTo", currentDate[1]);
        $w("#datasetGuestReservations").setFieldValue("lodging", lodging[0]);
        $w("#datasetGuestReservations").setFieldValue("lodgingSub", +lodging[1]);
    }
}

// special block below only for Management site -- all above shall be identical with Guest site

let loadingID = "";

function updateFilter() {
    const cntShownDirectly = 6;

    const onlyFuture = $w('#filterOnlyFuture').checked ? incUTCDate(new Date(), 1) : null;
    console.log("updateFilter for", $w("#filterSearch").value.trim(), "onlyFuture", onlyFuture != null);

    queryGuestReservations($w("#filterSearch").value.trim(), onlyFuture).then((items) => {
        console.log("updateFilter", items.length, "results:", items.map((i) => i.refId));
        const sorted = items.sort((a, b) => { return b.dateFrom - a.dateFrom; });
        $w("#repeaterFilterResults").data = sorted.slice(0, cntShownDirectly);
        $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
            $item("#textFilterResult").text = generateTitle(itemData);
            $item("#textFilterResultActive").text = generateTitle(itemData);
            $item("#textFilterResult").onClick(() => {
                if (loadingID == itemData._id) return;
                loadingID = itemData._id;
                console.log("#textFilterResult onClick", itemData._id);
                save(() => {
                    console.log("#textFilterResult onClick setFilter", itemData._id);
                    $w("#datasetGuestReservations").setFilter(wixData.filter().eq('_id', itemData._id)).then(() => {
                        loadingID = "";
                        updateFields();
                    })
                });
            });
        });
        if (sorted.length > cntShownDirectly) $w("#dropdownFilterResultsMore").expand();
        else $w("#dropdownFilterResultsMore").collapse();
        $w("#dropdownFilterResultsMore").options = sorted.slice(cntShownDirectly).map(item => { return { label: generateTitle(item), value: item._id } });
        updateFilterSelection();
    }).catch((err) => console.log(`Cannot filter and sort data set:`, err));
}

/**
 * Updates the selection state of the filter results based on the currently displayed item
 */
function updateFilterSelection() {
    const curID = $w("#datasetGuestReservations").getCurrentItem()._id;
    console.log("updateFilterSelection for ID", curID, "refId", $w("#datasetGuestReservations").getCurrentItem().refId);
    $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
        if (itemData._id == curID) {
            $item("#textFilterResult").hide();
            $item("#textFilterResultActive").show();
        } else {
            $item("#textFilterResult").show();
            $item("#textFilterResultActive").hide();
        }
    });
    $w("#dropdownFilterResultsMore").value = curID; //TODO correcxt?
}

/**
 * Updates inputs and the title based on the content of the current item, the price table and the currentDateOccupied state.
 */
function updateFields() {
    console.log("updateFields");
    updateFilterSelection();
    cloneItem();
    let item = $w("#datasetGuestReservations").getCurrentItem();
    $w("#textTitle").text = generateTitle(item);
    $w("#inputLodging").value = `${item.lodging}|${item.lodgingSub ?? 0}`;
    if (item.dateFrom && item.dateTo) {
        const cd = [new Date(item.dateFrom), new Date(item.dateTo)];
        $w("#inputArrivalTime").value = toLocal(cd[0]).getHours().toString();
        $w("#inputDepartureTime").value = toLocal(cd[1]).getHours().toString();
        updateCurrentDate(cd);
    } else {
        updateCurrentDate([null, null]);
    }
}

function generateTitle(item) {
    return `${dateRangeToString({ start: item.dateFrom }, {})} +${nightsBetween(item.dateFrom, item.dateTo)} ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub ?? ""}`.trim();
}

async function queryGuestReservations(searchText, minDate) {
    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let q = wixData.query("guestReservations").ne("refId", "new").limit(1000);
    if (minDate) q = q.ge("dateTo", minDate);

    const s = normalize(searchText).trim();
    if (s) {
        const sn = +s;
        if (s === sn.toString()) { // user entered a number
            let qOr = wixData.query("guestReservations").eq("cntAdults", sn);
            ["cntChildren", "paidSum", "lodgingSub"].forEach(f => { qOr = qOr.or(wixData.query("guestReservations").eq(f, sn)); });
            q = q.and(qOr);
        } else // user entered a string
            q = q.contains("searchField", s);
    }

    return (await q.find()).items;
}

function cloneItem(item = null) {
    item = item ?? $w("#datasetGuestReservations").getCurrentItem();
    originalItem = item ? structuredClone(item) : null;
    console.log("originalItem now is", originalItem);
}

function save(onSuccess = () => {}) {
    let item = $w("#datasetGuestReservations").getCurrentItem();
    console.log("save refId", item.refId);
    // when user tries to save the "new" item, create a new one instead (modification of "new" item will be blocked by hook)
    if (item.refId === "new") {
        item = { ...item };
        delete item._id;
        item.refId = undefined;
    }
    (item._id ? wixData.update("guestReservations", item) : wixData.insert("guestReservations", item)).then(() => {
        showSuccessIfChanged();
        onSuccess();
    }).catch(err => { showError(err); });
}

function revert(onSuccess = () => {}) {
    console.log("revert refId", $w("#datasetGuestReservations").getCurrentItem().refId);
    $w("#datasetGuestReservations").revert().then(() => {
        showSuccessIfChanged();
        onSuccess();
    }).catch(err => { showError(err); });
}

function remove(onSuccess = () => {}) {
    console.log("remove refId", $w("#datasetGuestReservations").getCurrentItem().refId);
    $w("#datasetGuestReservations").remove().then(() => {
        showSuccessIfChanged();
        onSuccess();
    }).catch(err => { showError(err); });
}

function unorderedEqual(a, b) {
    return a.length == b.length && a.every(v => b.includes(v)) && b.every(v => a.includes(v));
}

function showSuccessIfChanged() {
    const item = $w("#datasetGuestReservations").getCurrentItem();
    let diff = "";
    if (originalItem && item)
        for (const [f, v2] of Object.entries(item)) {
            const v1 = originalItem[f];
            if (f.startsWith("_") || f == "searchField" || f == "refId") {
                // ignore this fields
            } else if (v1 && v2 && new Date(v1).getFullYear() > 1900 && new Date(v2).getFullYear() > 1900) {
                if (new Date(v1).getTime() != new Date(v2).getTime()) diff += `\n${f}: ${dateRangeToString({start: toLocal(v1)})} => ${dateRangeToString({start: toLocal(v2)})}`;
            } else if (v1 && v2 && Array.isArray(v1) && Array.isArray(v2)) {
                if (!unorderedEqual(v1, v2)) diff += `\n${f}: ${v1} => ${v2}`;
            } else if (v1 && v2 && v1.formatted && v2.formatted) {
                if (v1.formatted != v2.formatted) diff += `\n${f}: ${v1.formatted} => ${v2.formatted}`;
            } else if (v1 != v2) diff += `\n${f}: ${v1} => ${v2}`;
        }
    console.log("showSuccessIfChanged diff:", diff);
    if (diff) {
        cloneItem(item);
        wixWindow.openLightbox("CMSSuccessLightbox", { diff });
    }
}

function showError(err) {
    console.log("showError", err);
    wixWindow.openLightbox("CMSErrorLightbox", { err });
}