import wixData from 'wix-data';
import wixUsers from 'wix-users-backend';
import { currentMember } from 'wix-members-backend';

import { isDateOccupied, sendMails } from 'backend/common.jsw';
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
    await buildSearchField(item);
    console.log("guestReservations_beforeInsert finally", item);
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
    return item;
}

export async function guestReservations_beforeUpdate(item, context) {
    console.log("guestReservations_beforeUpdate", item._id, context);
    if (!(await accessToGuests())) throw new Error("Not allowed");
    console.log("guestReservations_beforeUpdate allowed to edit");
    await buildSearchField(item);
    console.log("guestReservations_beforeUpdate finally", item);
    return item;
}

let lodgingsMap = null;

async function buildSearchField(item) {
    const hasContent = !!(new Date(item.dateFrom).getFullYear() >= 2000 || new Date(item.dateTo).getFullYear() >= 2000 || item.firstName || item.lastName || item.lodging || item.comment || item.note);
    if (!lodgingsMap) lodgingsMap = Object.fromEntries((await wixData.query("lodgings").find()).items.map(l => [l.lodgingID, l]));
    const lme = lodgingsMap[item.lodging];

    const normalize = (str) => str?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
    item.refId = item._id;
    if (!hasContent) {
        console.log("empty item will not get a searchfield:", item);
        item.searchField = "";
    }
    else item.searchField = [
        item.firstName,
        item.lastName,
        item.email,
        item.phoneNumber,
        item.address?.formatted ?? "",
        dateRangeToString({ start: item.dateFrom, end: item.dateTo }),
        item.lodging,
        item.lodgingSub, // must be directly after item.lodging
        lme ? `${lme.title} ${lme.capacityPrefix} ${item.lodgingSub}` : "",
        item.note,
        item.comment,
        item.state,
        item.paidSumup,
        item.deposit
    ].map(normalize).join(" ");
}

export async function guestReservations_afterInsert(item, context) {
    console.log("guestReservations_afterInsert", item);
    updateDisabledStates(item, true);
    sendMails(item, true, "Vielen Dank, [firstName] [lastName], für Ihre Anfrage!\n" +
        "Wir haben [lodging] vom [dateFrom] bis zum [dateTo] für Sie vorgemerkt.\n" +
        "Wir werden uns zeitnah bei Ihnen melden um Ihre Buchung zu bestätigen."); //TODO send all details like cntAdults, ...?
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
