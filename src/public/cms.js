
const LOG_DT = false;

function logDT(...args) {
    if (LOG_DT) console.log(...args);
}

export const ROLES = {
    GUESTS_MANAGEMENT: {
        label: "Gästeverwaltung",
        slug: "guests-management",
        id: "276cacd9-b43e-4e4e-8e3f-92192eb8eba7",
    },
    EVENTS_EDIT: {
        label: "Events bearbeiten",
        slug: "events-edit",
        id: "231ed231-93cf-45c1-9cbe-d99e7e45a27e",
    },
    FOOD_EDIT: {
        label: "Speisekarte bearbeiten",
        slug: "food-edit",
        id: "9cf0085c-a914-46de-a6b1-29aa4b86a76e",
    },
    SPORTS_EDIT: {
        label: "Sportangebote bearbeiten",
        slug: "sports-edit",
        id: "3ef4ffaa-79b2-440c-9872-802287e9407b",
    }
};

export const FormatTypesMonth = {
    narrow: 'narrow',
    short: 'short',
    long: 'long',
    numeric: 'numeric',
    twoDigit: '2-digit',
    none: null
};

export const FormatTypesWeekday = {
    narrow: 'narrow',
    short: 'short',
    long: 'long',
    none: null
};

export const FormatTypesNumeric = {
    numeric: 'numeric',
    twoDigit: '2-digit',
    none: null
};

/**
 * @param {object} start start date, shall be a Date object or a string parseable to a Date
 * @param {object} end optional end date to print a range instead of a single date
 * @param {object} options options for the date formatting
 * @param {string|string[]} options.locales the locale(s) to use for formatting, defaults to "de-DE"
 * @param {FormatTypesWeekday} options.weekday the format of the weekday, defaults to "short"
 * @param {FormatTypesNumeric} options.day the format of the day, defaults to "2-digit"
 * @param {FormatTypesMonth} options.month the format of the month, defaults to "short"
 * @param {FormatTypesNumeric} options.year the format of the year, defaults to "numeric"
 * @param {FormatTypesNumeric} options.hour the format of the hour, defaults to "2-digit"
 * @param {FormatTypesNumeric} options.minute the format of the minute, defaults to "2-digit"
 * @param {FormatTypesNumeric} options.second the format of the second, defaults to "none"
 * @param {object} options.start overrides for start date formatting only
 * @param {object} options.end overrides for end date formatting only
 * @returns {string} — human readable string of the range
 */
export function dateRangeToString(
    start,
    end = null,
    {
        locales = "de-DE",
        weekday = FormatTypesWeekday.short,
        day = FormatTypesNumeric.twoDigit,
        month = FormatTypesMonth.short,
        year = FormatTypesNumeric.numeric,
        hour = FormatTypesNumeric.twoDigit,
        minute = FormatTypesNumeric.twoDigit,
        second = FormatTypesNumeric.none,
        start: startOverrides = {},
        end: endOverrides = {}
    } = {}) {
    logDT("dateRangeToString", { start, end, locales, weekday, day, month, year, hour, minute, second, startOverrides, endOverrides });
    let res = "";
    let df = { timeZone: "Europe/Berlin" };
    const dStart = start ? new Date(start) : null;
    if (dStart && !isNaN(dStart.getTime())) {
        const ovr = (fmt, override) => override === undefined ? fmt : override;
        const setFmt = (obj, key, fmt, override) => {
            const v = ovr(fmt, override[key]);
            if (v != null) obj[key] = v;
        };
        setFmt(df, "weekday", weekday, startOverrides);
        setFmt(df, "day", day, startOverrides);
        setFmt(df, "month", month, startOverrides);
        setFmt(df, "year", year, startOverrides);
        setFmt(df, "hour", hour, startOverrides);
        setFmt(df, "minute", minute, startOverrides);
        setFmt(df, "second", second, startOverrides);
        res += dStart.toLocaleString(locales, df);
        const dEnd = end ? new Date(end) : null;
        if (dEnd && !isNaN(dEnd.getTime())) {
            const showDay = ovr(weekday, endOverrides.weekday) != null || ovr(day, endOverrides.day) != null || ovr(month, endOverrides.month) != null || ovr(year, endOverrides.year) != null;
            const showTime = ovr(hour, endOverrides.hour) != null || ovr(minute, endOverrides.minute) != null || ovr(second, endOverrides.second) != null;
            const sameDay = dStart.getDate() == dEnd.getDate() && dStart.getMonth() == dEnd.getMonth() && dStart.getFullYear() == dEnd.getFullYear();
            const sameTime = dStart.getHours() == dEnd.getHours() && dStart.getMinutes() == dEnd.getMinutes() && dStart.getSeconds() == dEnd.getSeconds();
            //if (!sameDay || (showTime && !sameTime)) {
            if ((showDay && !sameDay) || (showTime && !sameTime)) {
                res += " - ";
                const dfEnd = { timeZone: "Europe/Berlin" };
                if (!sameDay) {
                    setFmt(dfEnd, "weekday", weekday, endOverrides);
                    setFmt(dfEnd, "day", day, endOverrides);
                    setFmt(dfEnd, "month", month, endOverrides);
                    setFmt(dfEnd, "year", year, endOverrides);
                }
                setFmt(dfEnd, "hour", hour, endOverrides);
                setFmt(dfEnd, "minute", minute, endOverrides);
                setFmt(dfEnd, "second", second, endOverrides);
                res += dEnd.toLocaleString(locales, dfEnd);
            }
        }
    }
    return res;
}

export function stringToDateRange(str) {
    const parseDateTime = (text) => {
        const months = ["jan", "feb", "mär", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];
        for (let month = 0; month < 12; ++month) {
            if (text.toLowerCase().includes(months[month])) {
                const date = parseInt(text.slice(text.indexOf(",") + 1).trim(), 10);
                let year = parseInt(text.slice(text.lastIndexOf(" ") + 1), 10);
                if (year >= 0 && year <= 40) year += 2000;
                else if (year >= 0 && year <= 99) year += 1900;
                if (year >= 1900 && year <= 2100 && date >= 0 && date <= 31) return new Date(Date.UTC(year, month, date));
                return null;
            }
        }
        return null;
    };

    const dateTimeParts = str.split("-");
    let start = dateTimeParts.length == 0 ? null : parseDateTime(dateTimeParts[0].trim());
    let end = dateTimeParts.length <= 1 ? start : parseDateTime(dateTimeParts[1].trim());
    return [start, end];
}

/**
 * @param {object} eventDate — An item of the Event Dates dataset
 * @returns {Array<object>} — all single date-ranges found in the event-date in form {start[, end]}
 */
export function listAllRanges(eventDate) {
    let res = [];
    if (!eventDate.start) return res;
    const start = new Date(eventDate.start);
    const end = new Date(eventDate.end || start);

    const itv = eventDate.recurrenceInterval;
    if (!itv || itv <= 0) {
        // no repetition, one-time event: this can also span over multiple days
        res.push({ start, end });
        return res;
    }

    const rct = eventDate.recurrenceType;
    const mr = eventDate.monthlyRepetition || "weekday";
    let weekdays = eventDate.recurrenceDays;
    if (!weekdays || weekdays.length == 0) weekdays = [WEAKDAY_NAMES[start.getDay()]]; // if no weekday specified, assume only the week day that the start date has

    // duration shall only contain the *time* difference between end and start
    let duration = end.getTime() - start.getTime();
    let e = new Date(end);
    e.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    duration = e.getTime() - start.getTime();
    if (duration < 0) duration += 24 * 3600 * 1000;
    //console.info({ start, end, rct, itv, mr, weekdays, duration });

    let cur = new Date(start);
    cur.setUTCHours(0, 0, 0, 0);
    let count = 0;
    while (count < 1000) { // safety measure against dead loops
        //console.info({ cur, count, results: res.length });
        ++count;
        if (cur.getTime() > end.getTime()) return res; // end reached
        if ((rct != "weekly" || weekdays.includes(WEAKDAY_NAMES[cur.getUTCDay()])) &&
            (rct != "monthly" || (mr == "weekday" ? cur.getUTCDay() == start.getUTCDay() : cur.getUTCDate() == start.getUTCDate()))) {
            const dt0 = new Date(cur);
            const dt1 = duration > 0 ? new Date(cur) : null;
            dt0.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
            dt1?.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), 0);
            res.push({ start: dt0, end: dt1 });
        }
        switch (rct) {
            case "daily":
                cur.setUTCDate(cur.getUTCDate() + itv);
                break;
            case "weekly":
                // check each day, but respect itv after having processed all weekdays
                cur.setUTCDate(cur.getUTCDate() + 1);
                if (cur.getUTCDay() === start.getUTCDay()) cur.setUTCDate(cur.getUTCDate() + (itv - 1) * 7);
                break;
            case "monthly":
                switch (mr) {
                    case "weekday": { // like every second Monday of the month, based on the weekday of the start date
                        cur.setUTCMonth(cur.getUTCMonth() + itv, 1);
                        cur.setUTCDate(1 + (start.getUTCDay() - cur.getUTCDay() + 7) % 7 + (Math.ceil(start.getUTCDate() / 7) - 1) * 7);
                        // if the calculated day does not exist in this month (like 5th Monday), it will be skipped during the next iteration
                        if (cur.getUTCMonth() != (start.getUTCMonth() + count * itv) % 12) cur.setUTCDate(0);
                        break;
                    }
                    case "dayOfMonth": { // like every 15th of the month, based on the day of the month of the start date
                        const targetUTCDay = start.getUTCDate();
                        cur.setUTCMonth(cur.getUTCMonth() + itv, targetUTCDay);
                        // if the day does not exist in this month (like 30th in February), it will be skipped during the next iteration
                        if (cur.getUTCDate() != targetUTCDay) cur.setUTCDate(0);
                        break;
                    }
                }
                break;
            default:
                return res; // no iteration at all
        }
    }
    logDT(`Stopped after ${count} iterations, didn't reach ${end} from ${start}, got to ${cur}`);
    return res;
}

/**
 * @param {object} eventDate — An item of the Event Dates dataset
 * @returns {string} — human readable string describing the event-date as short as possible
 */
export function printRanges(eventDate) {
    const ranges = listAllRanges(eventDate);
    logDT("printRanges", { eventDate, ranges });
    if (ranges.length == 0) return ""; // no date at all
    const first = ranges[0];
    if (ranges.length == 1) return dateRangeToString(first.start, first.end); // no iteration at all
    const last = ranges[ranges.length - 1];

    const rct = eventDate.recurrenceType;
    const itv = parseInt(eventDate.recurrenceInterval) || 1;
    const mr = eventDate.monthlyRepetition || "weekday";
    let weekdays = eventDate.recurrenceDays;
    if (!weekdays || weekdays.length == 0) weekdays = [WEAKDAY_NAMES[first.start.getDay()]]; // if no weekday specified, assume only the week day that the start date has
    let res = "Ab ";

    let sameYear = first.start.getFullYear() == last.end.getFullYear();
    let sameMonth = sameYear && first.start.getMonth() == last.end.getMonth();
    logDT("printRanges", { first, last, sameYear, sameMonth, rct, itv, mr, weekdays });
    res += dateRangeToString(first.start, first.end, {
        year: sameYear ? FormatTypesNumeric.none : FormatTypesNumeric.numeric,
        month: sameMonth ? FormatTypesMonth.none : FormatTypesMonth.long,
        weekday: rct == "weekly" || (rct == "monthly" && mr == "weekday") ? null : FormatTypesWeekday.long,
        hour: null,
        minute: null
    });

    res += ` jeden `;
    const occNames = ["ersten", "zweiten", "dritten", "vierten", "fünften"];

    switch (rct) {
        case "daily":
            res += itv == 1 ? "" : `${occNames[itv - 1] || itv + "."} `;
            res += "Tag";
            break;
        case "weekly":
            res += itv == 1 ? "" : `${occNames[itv - 1] || itv + "."} `;
            weekdays.forEach((wd, i) => {
                const idx = WEAKDAY_NAMES.indexOf(wd);
                res += `${i == 0 ? "" : i == weekdays.length - 1 ? " und " : ", "}${idx != null ? WEAKDAY_NAMES_HR[idx] : "???"}`
            });
            break;
        case "monthly":
            switch (mr) {
                case "weekday": {
                    res += occNames[Math.ceil(first.start.getDate() / 7) - 1];
                    res += " ";
                    const idx = first.start.getDay();
                    res += idx == null ? "???" : WEAKDAY_NAMES_HR[idx];
                    res += itv == 1 ? " im Monat" : ` in jedem ${occNames[itv - 1] || itv + "."} Monat`;
                    if (Math.ceil(first.start.getDate() / 7) >= 5) res += " (soweit vorhanden)";
                    break;
                }
                case "dayOfMonth": {
                    res += first.start.getDate();
                    res += ". ";
                    res += itv == 1 ? "des Monats" : `jeden ${occNames[itv - 1] || itv + "."} Monats`;
                    if (first.start.getDate() > 28) res += " (soweit vorhanden)";
                    break;
                }
            }
            break;
    }
    res += " bis zum ";
    res += dateRangeToString(last.start, last.end, {
        year: FormatTypesNumeric.numeric,
        month: FormatTypesMonth.long,
        weekday: rct == "weekly" ? null : FormatTypesWeekday.long,
    });
    res += " Uhr";
    return res;
}

const WEAKDAY_NAMES = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const WEAKDAY_NAMES_HR = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function generateICS(events) {
    const pad = n => String(n).padStart(2, '0');
    const formatDate = date => date.getUTCFullYear() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) + 'T' +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) + 'Z';

    let lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//fsg-alfdorf.de//Events//EN"
    ];

    events.forEach(event => {
        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id || Date.now()}`,
            `DTSTAMP:${formatDate(new Date())}`,
            `DTSTART:${formatDate(event.start)}`,
            `DTEND:${formatDate(event.end)}`,
            `SUMMARY:${event.title}`,
            `DESCRIPTION:${event.description || ""}`,
            `LOCATION:${event.adress?.formatted || ""}`,
            "END:VEVENT"
        );
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
}

/**
 * @param {Date}   localDate
 * @returns {Date}
 */
export function toUTC(localDate) {
    const dt = new Date(localDate || Date.now());
    if (isNaN(dt.getTime())) return new Date();
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
}

/**
 * @param {object} utcDate shall be a Date object or a string parseable to a Date
 * @returns {Date}
 */
export function toLocal(utcDate) {
    const dt = new Date(utcDate || Date.now());
    if (isNaN(dt.getTime())) return new Date();
    return new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
}

export function incUTCDate(date, delta) {
    const res = new Date(date);
    res.setUTCDate(date.getUTCDate() + delta);
    return res;
}

/**
 * Returns number of nights between the two dates.
 * @param {any}   dateFrom
 * @param {any}   dateTo
 * @returns {Number}
 */
export function nightsBetween(dateFrom, dateTo) {
    if (dateFrom && dateTo) {
        const d1 = new Date(dateFrom);
        const d2 = new Date(dateTo);
        d1.setUTCHours(0, 0, 0, 0);
        d2.setUTCHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    } else return 0;
}

function testDateTimeToString() {
    const testDate = new Date(2026, 3, 9, 8, 15);
    const testDateSameDay = new Date(2026, 3, 9, 14, 30);
    const testDateSameTime = new Date(2026, 4, 12, 8, 15);
    const testDateOther = new Date(2026, 4, 12, 14, 30);
    const optOnlyTime = { year: null, weekday: null, month: null, day: null };
    const optOnlyDay = { hour: null, minute: null, second: null };
    const optDayAndTime = { year: null, weekday: null };
    const optDayAndTimeShort = { year: FormatTypesNumeric.numeric, weekday: FormatTypesWeekday.narrow, month: FormatTypesMonth.numeric, day: FormatTypesNumeric.numeric, hour: FormatTypesNumeric.numeric, minute: FormatTypesNumeric.numeric };

    console.log("One day", dateRangeToString(testDate));
    console.log("One day only day", dateRangeToString(testDate, null, optOnlyDay));
    console.log("One day only time", dateRangeToString(testDate, null, optOnlyTime));
    console.log("One day day+time", dateRangeToString(testDate, null, optDayAndTime));
    console.log("One day day+time short", dateRangeToString(testDate, null, optDayAndTimeShort));

    console.log("Same date", dateRangeToString(testDate, testDate));
    console.log("Same date only day", dateRangeToString(testDate, testDate, optOnlyDay));
    console.log("Same date only time", dateRangeToString(testDate, testDate, optOnlyTime));
    console.log("Same date day+time", dateRangeToString(testDate, testDate, optDayAndTime));
    console.log("Same date day+time short", dateRangeToString(testDate, testDate, optDayAndTimeShort));

    console.log("Same day", dateRangeToString(testDate, testDateSameDay));
    console.log("Same day only day", dateRangeToString(testDate, testDateSameDay, optOnlyDay));
    console.log("Same day only time", dateRangeToString(testDate, testDateSameDay, optOnlyTime));
    console.log("Same day day+time", dateRangeToString(testDate, testDateSameDay, optDayAndTime));
    console.log("Same day day+time short", dateRangeToString(testDate, testDateSameDay, optDayAndTimeShort));

    console.log("Same time", dateRangeToString(testDate, testDateSameTime));
    console.log("Same time only day", dateRangeToString(testDate, testDateSameTime, optOnlyDay));
    console.log("Same time only time", dateRangeToString(testDate, testDateSameTime, optOnlyTime));
    console.log("Same time day+time", dateRangeToString(testDate, testDateSameTime, optDayAndTime));
    console.log("Same time day+time short", dateRangeToString(testDate, testDateSameTime, optDayAndTimeShort));
}
