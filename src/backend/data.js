import wixData from 'wix-data';
import wixUsers from 'wix-users-backend';
import { currentMember } from 'wix-members-backend';

import { triggeredEmails, contacts } from 'wix-crm-backend';
import { isDateOccupied, calculateReservationPrice } from 'backend/common.jsw';
import { dateRangeToString } from 'public/cms.js';

async function accessToGuests() {
    if (!wixUsers.currentUser.loggedIn) {
        console.warn("No user logged in");
        return false;
    }
    const roles = await currentMember.getRoles();
    console.log("accessToGuests", currentMember, wixUsers.currentUser, roles);
    // Role is "Gästerverwalter" or "Admin"
    return roles.some((role) => role._id == "276cacd9-b43e-4e4e-8e3f-92192eb8eba7" || role._id == "00000000-0000-0000-0000-000000000001");
}

export async function guestReservations_beforeCount(query, context) {
    console.log("guestReservations_beforeCount", query, context);
    if (!(await accessToGuests())) query = query.limit(0); // don't throw here
    return query;
}

export async function guestReservations_beforeGet(request, context) {
    console.log("guestReservations_beforeGet", request, context);
    if (!(await accessToGuests())) throw new Error("Not allowed");
    return request;
}

export async function guestReservations_beforeInsert(item, context) {
    console.log("guestReservations_beforeInsert", item._id, context);
    if (!(await accessToGuests())) {
        item.state = "Anfrage";
        delete item.comment;
        delete item.paidSum;
        delete item.paidSumup;
        if ((await isDateOccupied(item.lodging, item.lodgingSub, new Date(item.dateFrom), new Date(item.dateTo)), false, item._id).occupied)
            throw new Error("Invalid date range");
    }
    buildSearchField(item);
    return item;
}

export async function guestReservations_beforeQuery(request, context) {
    console.log("guestReservations_beforeQuery", request, context);
    if (!(await accessToGuests())) request.query = request.query.limit(0); // don't throw here
    return request;
}

export async function guestReservations_beforeRemove(item, context) {
    console.log("guestReservations_beforeRemove", item._id, context);
    if (!(await accessToGuests())) throw new Error("Not allowed");
    if (item.refId == "new") throw new Error("Cannot remove this item - it is a must-have placeholder");
    return item;
}

export async function guestReservations_beforeUpdate(item, context) {
    console.log("guestReservations_beforeUpdate", item._id, context);
    if (!(await accessToGuests())) throw new Error("Not allowed");
    if (item.refId == "new") return {
        _id: item._id,
        refId: item.refId,
        comment: "Placeholder for new items",
    };
    buildSearchField(item);
    return item;
}

let lodgingsMap = null;

async function buildSearchField(item) {
    if (!lodgingsMap) lodgingsMap = Object.fromEntries((await wixData.query("lodgings").find()).items.map(l => [l.lodgingID, l]));
    const lme = lodgingsMap[item.lodging];

    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
    item.refId = item._id;
    item.searchField = [
        item.firstName,
        item.lastName,
        item.email,
        item.phoneNumber,
        item.address.formatted,
        dateRangeToString({ start: item.dateFrom, end: item.dateTo }),
        item.lodging,
        item.lodgingSub, // must be directly after item.lodging
        `${lme.title} ${lme.capacityPrefix} ${item.lodgingSub}`,
        item.note,
        item.comment,
        item.state,
        item.paidSumup,
        item.deposit,
        item.refId
    ].map(normalize).join(" ");
}

export async function guestReservations_afterInsert(item, context) {
    console.log("guestReservations_afterInsert", item);
    updateDisabledStates(item, true);
    sendMails(item);
    return item;
}

export function guestReservations_afterRemove(item, context) {
    console.log("guestReservations_afterRemove", item._id, context);
    wixData.remove("disabledDates", item._id).catch(err => console.error("guestReservations_afterRemove:", err));
    return item;
}

export function guestReservations_afterUpdate(item, context) {
    console.log("guestReservations_afterUpdate", item._id, context);
    updateDisabledStates(item, false);
    return item;
}

function updateDisabledStates(item, insert) {
    if (item.refId != "new") {
        const data = {
            _id: item._id,
            dateFrom: item.dateFrom,
            dateTo: item.dateTo,
            lodging: item.lodging,
            lodgingSub: item.lodgingSub
        };
        if (insert)
            wixData.insert("disabledDates", data)
        else
            wixData.update("disabledDates", data);
    }
}

async function sendMails(item) {
    try {
        const resL = await wixData.query("lodgings").eq("lodgingID", item.lodging).find();
        if (resL.items.length > 1) console.error(`Have multiple matches from #lodgings with lodgingID == ${item.lodging}: ${resL.items}`);
        if (resL.items.length == 0) console.error(`Could not find #lodgings with lodgingID == ${item.lodging}`);
        let lodgingName = String(item.lodging);
        if (resL.items.length > 0) {
            lodgingName = resL.items[0].title;
            if (item.lodgingSub > 0) lodgingName = `${lodgingName} ${resL.items[0].capacityPrefix} ${item.lodgingSub}`;
        }

        let table = [];
        table.push(["Leistung", "# Erw.", "# Nächte", "Preis je", "Gesamt"]);
        let sum = 0;
        let sumDeposit = 0;
        (await calculateReservationPrice(item.lodging, new Date(item.dateFrom), new Date(item.dateTo), item.cntAdults, item.cntChildren)).forEach(line => {
            console.log("calculateReservationPrice", line);
            let row = [line.title, line.cntAdults ? `* ${line.cntAdults}` : "", line.cntNights ? `* ${line.cntNights}` : ""];
            const price = line.price * (line.cntAdults || 1) * (line.cntNights || 1);
            if (line.depositName) {
                sumDeposit += price;
                row.push(`(${line.price.toFixed(2)} €)`, `(${price.toFixed(2)} €)`);
            } else {
                sum += price;
                row.push(`${line.price.toFixed(2)} € `, `${price.toFixed(2)} € `);
            }
            table.push(row);
        });
        table.push(["Summe", "", "", "", `${sum.toFixed(2)} € `]);
        if (sumDeposit > 0)
            table.push(["+ Kaution/Pfand", "", "", "", `(${sumDeposit.toFixed(2)} €)`]);

        const options = {
            firstName: item.firstName ?? "",
            lastName: item.lastName ?? "",
            email: item.email ?? "",
            note: item.note ?? "",
            lodging: lodgingName ?? "",
            dateFrom: convertToDate(item.dateFrom),
            dateTo: convertToDate(item.dateTo),
            priceTable: convertToTable(table, [false, true, true, true, true]),
            priceHTML: convertToHTML(table, [false, true, true, true, true])
        };

        console.log("sendMails", item.firstName, item.lastName, item.email, options);
        //sendMail("ReservationRequested", item, options); FIXME
        //sendMail("ReservationAttention", { firstName: "web", lastName: "master", email: "webmaster@fsg-alfdorf.de" }, options);
    } catch (err) {
        console.error("sendMails", err);
    }
}

function convertToDate(v) {
    return new Date(v).toLocaleDateString("de-DE", { weekday: "long", month: "long", year: "numeric", day: "numeric" });
}

function convertToHTML(table, alignRight) {
    const cls = "";
    const sumDeposit = 123;
    const sumReturn = 345;
    const sum = 678;
    let html = `<table><thead><tr>`;
    html += `<th${cls}>Leistung</th>`;
    html += `<th${cls}>Anzahl Erw.</th>`;
    html += `<th${cls}>Nächte</th>`;
    html += `<th${cls}>Einzelpreis</th>`;
    html += `<th${cls}>Gesamt</th>`;
    html += "</tr></thead><tbody>";
    html += "<tr>";
    html += `<td${cls}"><b>Summe</b></td>`;
    html += "<td></td>";
    html += "<td></td>";
    html += "<td></td>";
    html += `<td${cls}"><b>${sum.toFixed(2)} €</b></td>`;
    html += "</tr>";
    if (sumDeposit > 0) {
        html += "<tr>";
        html += `<td${cls}"><b>+ Kaution/Pfand</b></td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${cls}"><b>(${sumDeposit.toFixed(2)} €)</b></td>`;
        html += "</tr>";
    }
    if (sumReturn > 0) {
        html += "<tr>";
        html += `<td${cls}"><b>- Kaution/Pfand zurück</b></td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${cls}"><b>(-${sumReturn.toFixed(2)} €)</b></td>`;
        html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
}

function convertToTable(table, alignRight, fillChar = " ") {
    let colWidths = [];
    for (let rowIdx = 0; rowIdx < table.length; ++rowIdx) {
        const row = table[rowIdx];
        for (let colIdx = 0; colIdx < row.length; ++colIdx) {
            while (colIdx >= colWidths.length) colWidths.push(0);
            colWidths[colIdx] = Math.max(colWidths[colIdx], String(row[colIdx]).length);
        }
    }
    let res = "";
    for (let rowIdx = 0; rowIdx < table.length; ++rowIdx) {
        const row = table[rowIdx];
        for (let colIdx = 0; colIdx < row.length; ++colIdx) {
            const s = String(row[colIdx]);
            const fill = fillChar.repeat(colWidths[colIdx] - s.length);
            if (alignRight[colIdx]) {
                res += fill;
                res += s;
            } else {
                res += s;
                res += fill;
            }
            if (colIdx < row.length - 1) res += fillChar + "|" + fillChar;
        }
        res += "\n";
    }
    return res;
}

function sendMail(mailId, item, options) {
    contacts.appendOrCreateContact({
        name: { first: item.firstName, last: item.lastName, },
        emails: [{ email: item.email }, ]
    }).then((contactInfo) => {
        triggeredEmails.emailContact(mailId, contactInfo.contactId, { variables: options }).catch((err) => {
            console.error(`Cannot send e-mail ${mailId}`, err);
        });
    }).catch((err) => {
        console.error("Cannot create contact", err);
    });
}