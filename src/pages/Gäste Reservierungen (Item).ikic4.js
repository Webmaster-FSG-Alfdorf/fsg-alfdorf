import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';

import { dateRangeToString, stringToDateRange, toUTC, toLocal, debugStr, incUTCDate, nightsBetween } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, generateCostsTable, generateHTMLTable } from 'backend/common.jsw';

let currentDate = [null, null];
let currentDateOccupied = "";
let occupationsRange = [new Date(), new Date()];
let originalItem = null;

$w.onReady(function () {
    wixData.query("lodgings").ascending("order").find().then((results) => {
        let options = [];
        // main lodgings go first
        results.items.forEach((lodging) => {
            options.push({ label: lodging.title, value: `${lodging.lodgingID}|0` });
        });
        $w("#inputLodging").options = options;
        // then all sub lodgings
        results.items.forEach(async (lodging) => {
            if (lodging.capacity > 1) {
                for (let index = 1; index <= lodging.capacity; index++) options.push({
                    label: await generateLodgingName({ lodging: lodging.lodgingID, capacityPrefix: lodging.capacityPrefix, lodgingSub: index }),
                    value: `${lodging.lodgingID}|${index}`
                });
                $w("#inputLodging").options = options;
            }
        });
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
                updateCurrentDate([new Date(event.data.selectedDates[0]), new Date(event.data.selectedDates[1])]);
            }
            if (event.data && event.data.displayedMonth && event.data.displayedYear) {
                occupationsRange = [
                    new Date(event.data.displayedYear, event.data.displayedMonth - 1, 21),
                    new Date(event.data.displayedYear, event.data.displayedMonth + 1, 7)
                ];
                updateOccupations($w("#datasetGuestReservations").getCurrentItem()?._id, $w("#inputLodging").value.split("|"));
            }
        });

        updateForm(false, false);
        $w("#inputLodging").onChange(async () => {
            console.log("#inputLodging onChange");
            updateForm(false, true);
        })
        $w("#inputAdults").onChange(async () => {
            console.log("#inputAdults onChange");
            updateForm(false, false);
        })
        $w("#inputChildren").onChange(async () => {
            console.log("#inputChildren onChange");
            updateForm(false, false);
        })
        $w("#inputArrivalTime").onChange(async () => {
            console.log("#inputArrivalTime onChange");
            updateForm(true, false);
        })
        $w("#inputDepartureTime").onChange(async () => {
            console.log("#inputDepartureTime onChange");
            updateForm(true, false);
        })

        $w("#inputDate").onKeyPress(async (event) => {
            if (event.key == "Enter") {
                console.log("#inputDate onKeyPress Enter");
                updateCurrentDate(stringToDateRange($w("#inputDate").value));
            }
        });
        $w("#inputDate").onBlur(async () => {
            console.log("#inputDate onBlur");
            updateCurrentDate(stringToDateRange($w("#inputDate").value));
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
            resetCustomFields()
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
        $w("#inputDeposit").onChange(() => updateForm());
        $w("#inputPaidSum").onInput(() => updateForm());
        $w("#inputPaidSum").onBlur(() => updateForm());

        $w("#dropdownFilterResultsMore").onChange(() => { setCurrentFilter($w("#dropdownFilterResultsMore").value); });

        updateFields();

        $w("#buttonSave").onClick(() => save());
        $w("#buttonRevert").onClick(() => revert());
        $w("#buttonRemove").onClick(() => remove());
        $w("#buttonNew").onClick(() => save(() => {
            console.log("#buttonNew onClick add()");
            $w("#datasetGuestReservations").add().then(async () => {
                console.log("#buttonNew onClick add() then");
                resetCustomFields()
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

        // end special block
    });
});

async function updateCurrentDate(cd) {
    if (currentDate[0] == cd[0] && currentDate[1] == cd[1]) return;
    console.log("updateCurrentDate", debugStr(cd[0]), debugStr(cd[1]));
    currentDate = cd;
    if (cd[0] && cd[1]) {
        $w("#inputArrivalTime").value = toLocal(cd[0]).getHours().toString();
        $w("#inputDepartureTime").value = toLocal(cd[1]).getHours().toString();
    } else {
        $w("#inputArrivalTime").selectedIndex = 0;
        $w("#inputDepartureTime").selectedIndex = 0;
    }
    updateForm(true, false);
}

/**
 * Updates currentDate based on user input from #inputArrivalTime and #inputDepartureTime (ignores content of #inputDate).
 * 
 * Updates #inputDate, the price table and the currentDateOccupied state based on (updated) currentDate and #inputLodging.
 * 
 * Updates the current item's fields based on (updated) currentDate and #inputLodging.
 */
async function updateForm(writeDates, writeLodging) {
    console.log("updateForm");

    const curID = $w("#datasetGuestReservations").getCurrentItem()?._id;
    const lodging = $w("#inputLodging").value.split("|");
    const depositGiven = $w("#inputDeposit").value;
    const cntAdults = Number($w("#inputAdults").value);
    const paidSum = Number($w("#inputPaidSum").value);
    console.log("updateForm", curID, "lodging", lodging, "currentDate [", debugStr(currentDate[0]), ",", debugStr(currentDate[1]), "]");

    $w("#buttonPhone").link = `tel:${$w("#inputPhone").value}`;
    $w("#buttonSendMail").link = `mailto:${$w("#inputMail").value}`;

    ["#inputArrivalTime", "#inputDepartureTime"].forEach((id, i) => {
        console.log("updateForm", id, "with", $w(id).value, "to", currentDate[i]);
        if (currentDate[i]) {
            currentDate[i].setUTCHours(0, 0, 0, 0);
            let local = toLocal(currentDate[i]);
            local.setHours(Number($w(id).value), 0, 0, 0);
            currentDate[i] = toUTC(local);
        }
    });
    const cd = [currentDate[0] ? new Date(currentDate[0]) : null, currentDate[1] ? new Date(currentDate[1]) : null];
    console.log("updateForm", "currentDate now [", debugStr(cd[0]), ",", debugStr(cd[1]), "]");

    if (!cd[0] || !cd[1] || !curID)
        currentDateOccupied = ""
    else if (!lodging[0]) {
        // would just return {occupied: true} anyway
        currentDateOccupied = "Bitte zuerst eine Unterkunft wählen.";
    } else try {
        const res = await isDateOccupied(lodging[0], Number(lodging[1]), cd[0], cd[1], true, curID);
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
    console.log("updateForm currentDateOccupied =", currentDateOccupied);

    console.log("postMessage", { currentDate });
    $w("#htmlDate").postMessage({ currentDate });

    $w("#inputDate").value = dateRangeToString({ start: cd[0], end: cd[1] }, { hour: null, minute: null });
    $w("#inputDate").resetValidityIndication();
    $w("#inputArrivalTime").value = toLocal(cd[0]).getHours().toString();
    $w("#inputArrivalTime").resetValidityIndication();
    $w("#inputDepartureTime").value = toLocal(cd[1]).getHours().toString();
    $w("#inputDepartureTime").resetValidityIndication();

    if (writeDates) {
        await $w("#datasetGuestReservations").setFieldValue("dateFrom", cd[0] ?? new Date(0));
        await $w("#datasetGuestReservations").setFieldValue("dateTo", cd[1] ?? new Date(0));
    }
    if (writeLodging) {
        await $w("#datasetGuestReservations").setFieldValue("lodging", lodging[0]);
        await $w("#datasetGuestReservations").setFieldValue("lodgingSub", Number(lodging[1]));
    }

    updateOccupations(curID, lodging);

    generateCostsTable({ lodging: lodging[0], dateFrom: cd[0], dateTo: cd[1], cntAdults }, depositGiven, paidSum).then(costs => {
        generateHTMLTable(costs, [
            "Leistung",
            { label: "Anzahl Erw.", align: "right" },
            { label: "Nächte", align: "right" },
            { label: "Einzelpreis", align: "right" },
            { label: "Gesamt", align: "right" },
        ]).then(html => $w("#textReservationPrice").html = html);
    });

    //TODO update deposit list: list only items that are part of lodging
}

async function updateOccupations(curId, lodging) {
    let oc = [];
    if (curId) try {
        oc = await getOccupations(lodging[0], +lodging[1], new Date(occupationsRange[0]), new Date(occupationsRange[1]), curId);
    } catch (err) {
        oc.capacity = 0;
        oc.occupations = [];
    }
    console.log("updateOccupations for ", curId, lodging, "postMessage", oc);
    $w("#htmlDate").postMessage({ capacity: oc.capacity, occupations: oc.occupations });
}

function resetCustomFields() {
    console.log("resetCustomFields");
    updateFields();
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

    queryGuestReservations(searchText, onlyFuture).then(async (items) => {
        const sorted = items.sort((a, b) => { return b.dateFrom - a.dateFrom; });
        sortedResults = sorted.map((i) => i._id);
        console.log("updateFilter", items.length, "results:", sortedResults);
        $w("#repeaterFilterResults").data = sorted.slice(0, cntShownDirectly);
        if (sorted.length > cntShownDirectly)
            $w("#dropdownFilterResultsMore").expand();
        else
            $w("#dropdownFilterResultsMore").collapse();
        $w("#dropdownFilterResultsMore").options = sorted.slice(cntShownDirectly).map(item => { return { label: generateTitle(item), value: item._id } });
        setTimeout(() => {
            $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
                $item("#textFilterResult").text = generateTitle(itemData);
                $item("#textFilterResultActive").text = generateTitle(itemData);
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
            console.log("setCurrentFilter updateFields", itemId);
            updateFields();
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

/**
 * Updates inputs and the title based on the content of the current item, the price table and the currentDateOccupied state.
 */
function updateFields() {
    console.log("updateFields");
    updateFilterSelection();
    let item = $w("#datasetGuestReservations").getCurrentItem();
    cloneItem(item);
    const newTitle = generateTitle(item);
    $w("#textTitle").text = newTitle;
    if (item) {
        $w("#repeaterFilterResults").forEachItem(($item, itemData) => {
            if (itemData._id == item._id) {
                $item("#textFilterResult").text = newTitle;
                $item("#textFilterResultActive").text = newTitle;
            }
        });
        let opt = $w("#dropdownFilterResultsMore").options;
        opt.forEach((o) => { if (o.value == item._id) o.label = newTitle });
        $w("#dropdownFilterResultsMore").options = opt;
    }
    $w("#inputLodging").value = item ? `${item.lodging}|${item.lodgingSub ?? 0}` : "";
    if (item && item.dateFrom && item.dateTo)
        updateCurrentDate([new Date(item.dateFrom), new Date(item.dateTo)]);
    else
        updateCurrentDate([null, null]);
}

function generateTitle(item) {
    if (item && (item.dateFrom || item.dateTo || item.lastName || item.lodging))
        return `${dateRangeToString({ start: item.dateFrom }, { hour: null, minute: null })} +${nightsBetween(item.dateFrom, item.dateTo)}N ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub > 0 ? item.lodgingSub : ""}`.trim();
    else
        return "(Neue Reservierung)";
}

async function queryGuestReservations(searchText, minDate) {
    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // ignore empty entries
    let q = wixData.query("guestReservations").isNotEmpty("searchField").descending("_updatedDate").limit(1000);
    if (minDate) q = q.ge("dateTo", minDate);

    const s = normalize(searchText).trim();
    if (s) {
        const sn = +s;
        if (s == sn.toString()) { // user entered a number
            let qOr = wixData.query("guestReservations").eq("cntAdults", sn);
            ["cntChildren", "paidSum", "lodgingSub"].forEach(f => { qOr = qOr.or(wixData.query("guestReservations").eq(f, sn)); });
            q = q.and(qOr);
        } else // user entered a string
            q = q.contains("searchField", s);
    }

    return (await q.find()).items;
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

        diffField("Name", originalItem.firstName + " " + originalItem.lastName, item.firstName + " " + item.lastName);

        diffField("E-Mail", originalItem.email, item.email);

        diffField("Telefonnummer", originalItem.phoneNumber, item.phoneNumber);

        diffField("Adresse", originalItem.address?.formatted, item.address?.formatted);

        diffField("Hinweise", originalItem.notes, item.notes);

        diffField("Datenschutzerklärung", originalItem.privacyPolicy ? "Ja" : "Nein", item.privacyPolicy ? "Ja" : "Nein");

        diffField("Pfand/Kaution", originalItem.deposit.toString(), item.deposit.toString());

        diffField("Bezahlt", originalItem.paidSum.toFixed(2) + " €", item.paidSum.toFixed(2) + " €");

        diffField("SumupID", originalItem.paidSumup, item.paidSumup, false);

        diffField("Interner Kommentar", originalItem.comment, item.comment, false);
    }

    console.log("save", item?._id, "diff:", diff);

    $w("#datasetGuestReservations").save().then(() => {
        console.log("save then");
        if (diff)
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
        resetCustomFields();
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
        resetCustomFields(); //TODO assert getCurrentItem()==null ?
        onSuccess();
    }).catch(err => { showError(err) });
}

function showError(err) {
    console.log("showError", err);
    wixWindow.openLightbox("CMSErrorLightbox", { msg: err });
}