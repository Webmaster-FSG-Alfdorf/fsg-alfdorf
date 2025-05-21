let current = new Date();
let startDate = new Date();
let disabledDates = new Set();
current.setUTCDate(1);
current.setUTCHours(0, 0, 0, 0);

let pickStart = 0;
let dateRange = [null, null];
let daysOfPrevMonth = 0;
let occupations = [];
let capacity = 0;
let minDate = new Date(new Date(1900, 0, 1));
let maxDate = new Date(new Date(3000, 0, 1));

function changeMonth(delta) {
    current.setUTCMonth(current.getUTCMonth() + delta);
    generateDatePicker();
    parent.postMessage({ displayedMonth: current.getUTCMonth(), displayedYear: current.getUTCFullYear() }, "*");
}

window.addEventListener("message", (event) => {
    if (event.data) {
        if (event.data.currentDate) {
            if (event.data.currentDate[0] && event.data.currentDate[1]) {
                dateRange = [new Date(event.data.currentDate[0]), new Date(event.data.currentDate[1])];
                if (current.getUTCMonth() != dateRange[0].getUTCMonth() || current.getUTCFullYear() != dateRange[0].getUTCFullYear()) {
                    // go to the beginning of our selected range, if we not already show this month
                    current.setUTCFullYear(dateRange[0].getUTCFullYear());
                    current.setUTCMonth(dateRange[0].getUTCMonth());
                    changeMonth(0);
                }
            } else {
                // reset to show the current month without any selection
                dateRange = [null, null];
                current = new Date();
                current.setUTCDate(1);
                current.setUTCHours(0, 0, 0, 0);
                changeMonth(0);
            }
        }
        if (event.data.occupations) {
            occupations = event.data.occupations; // for efficiency we don't copy this one
            disabledDates.clear();
        }
        if (event.data.capacity) capacity = event.data.capacity;
        if (event.data.minDate) {
            minDate = new Date(event.data.minDate);
            minDate.setUTCHours(0, 0, 0, 0);
        }
        if (event.data.maxDate) {
            maxDate = new Date(event.data.maxDate);
            maxDate.setUTCHours(0, 0, 0, 0);
        }
        generateDatePicker();
    }
});

function pickDay(year, month, date) {
    if (pickStart == 0) {
        // start selection with both on the same date
        const dt = new Date(Date.UTC(year, month, date));
        dateRange[0] = dt;
        dateRange[1] = dt;
        updateSel();
    } else { // pickStart == 1
        if (dateRange[0].toLocaleDateString() == dateRange[1].toLocaleDateString()) {
            // cancel selection if not at least two day (one night) has been selected
            dateRange = [null, null];
            updateSel();
        } else if (!selDay(year, month, date)) {
            // cancel selection if it contained disabled dates
            dateRange = [null, null];
            updateSel();
        } else {
            if (dateRange[0] > dateRange[1]) { // swap so dateRange is always a positive range
                const tmp = dateRange[0];
                dateRange[0] = dateRange[1];
                dateRange[1] = tmp;
            }
            parent.postMessage({ selectedDates: dateRange }, "*");
        }
    }
    pickStart = 1 - pickStart;
    document.getElementById("tooltip").textContent = pickStart === 0 ? "Zum Ändern neues Datum wählen." : "Jetzt Abreisedatum wählen.";
}

function selDay(year, month, date) {
    if (pickStart == 1 && dateRange[0]) {
        const dtSel = new Date(Date.UTC(year, month, date));
        // check all selected days if they are valid in same direction as the user selected them
        let dt = new Date(dateRange[0]);
        const forward = dt < dtSel;
        while (forward ? dt < dtSel : dt > dtSel) {
            if (disabledDates.has(dt.toISOString().slice(0, 10))) {
                // stop selection before first / after last blocked day
                incUTCDate(dt, forward ? -1 : 1);
                dateRange[1] = new Date(dt);
                updateSel();
                return false;
            }
            incUTCDate(dt, forward ? 1 : -1);
        }
        dateRange[1] = dtSel;
        updateSel();
        return true;
    }
    return false;
}

function updateSel() {
    let idx0 = dateRange[0] ? Math.floor((dateRange[0] - startDate) / (1000 * 60 * 60 * 24)) : -1;
    let idx1 = dateRange[1] ? Math.floor((dateRange[1] - startDate) / (1000 * 60 * 60 * 24)) : -1;

    if (idx0 > idx1) { // swap so always idx0 <= idx1
        const tmp = idx0;
        idx0 = idx1;
        idx1 = tmp;
    }

    for (let i = 0; i < 6 * 7; ++i) {
        const cell = document.querySelector(`[data-idx="${i}"]`);
        if (cell) {
            if (i >= idx0 && i <= idx1) cell.classList.add("sel");
            else cell.classList.remove("sel");
        }
    }
}

function generateDatePicker() {
    startDate = new Date(current);
    startDate.setUTCDate(1);
    incUTCDate(startDate, -(((startDate.getUTCDay() - 1) + 7) % 7));
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    daysOfPrevMonth = ((current.getUTCDay() - 1) + 7) % 7;

    const canPrev = minDate <= startDate;
    const canNext = maxDate >= endDate;

    let html = `<table><thead>`;
    html += `<tr>`;
    html += `<th><span class="${canPrev ? "month-nav" : "month-nav-disabled"}" onclick="changeMonth(-1)">&#x25C0;</span></th>`;
    html += `<th colspan=3>${current.toLocaleDateString("de-DE", { month: "long", timeZone: 'Europe/Berlin' })}</th>`;
    html += `<th colspan=3>${current.getUTCFullYear()}</th>`;
    html += `<th><span class="${canNext ? "month-nav" : "month-nav-disabled"}" onclick="changeMonth(+1)">&#x25B6;</span></th>`;
    html += `</tr>`;
    html += `<tr><th>KW</th><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr>`;
    html += `</thead><tbody><tr>\n`;

    let dt = new Date();
    for (let i = 0; i < 6 * 7; ++i) {
        const dt = new Date(current);
        incUTCDate(dt, -daysOfPrevMonth + i);
        dt.setUTCHours(0, 0, 0, 0);

        // wrap into new row before printing Mondays
        if (dt.getUTCDay() == 1) html += `</tr><tr><td>${getCalendarWeek(dt)}</td>\n`;

        // generate different background based on occupation of the day
        const steps = 8; //FIXME 24? 12? 8? 6? 4?
        let ocSums = Array(steps).fill(0);
        for (let h = 0; h < steps; ++h) {
            let dt0 = new Date(dt);
            dt0.setUTCHours(h * 24 / steps, 0, 0, 0);
            let dt1 = new Date(dt);
            dt1.setUTCHours((h + 1) * 24 / steps - 1, 59, 59, 999);
            occupations.forEach((oc) => { if (oc.start < dt0 && oc.end > dt1) ocSums[h] += oc.count; });
        }
        const ocMin = Math.min(...ocSums);

        const perc = 100.0 / steps;
        let style = "background: linear-gradient(to right";
        for (let h = 0; h < steps; ++h) {
            //const bg = ocSums[h] >= capacity ? "#f8d7da" : ocSums[h] > capacity / 4 * 3 ? "#ffe5b4" : ocSums[h] > capacity / 3 ? "#fff3cd" : "#d4edda";
            const bg = getHSLColorFromOccupation(ocSums[h], capacity);
            style += `, ${bg} ${(perc * h).toFixed(2)}% ${(perc * (h + 1)).toFixed(2)}%`;
        }
        style += ")";

        // use different font color for days from neighbouring months
        let cls = `${dt.getUTCMonth() == current.getUTCMonth() ? "cell-cur" : "cell-other"}`;

        // ... and for cells outside of the valid range
        const outOfRange = dt < minDate || dt > maxDate;
        if (outOfRange) {
            cls += " cell-out-of-range";
            style = "";
        }

        // mark selected days
        if (dateRange[0] && dateRange[1] && dateRange[0] <= dt && dateRange[1] >= dt) cls += " sel";

        // make cells clickable, but only if not fully occupied
        const disabled = ocMin >= capacity || outOfRange;
        let interactive = "";
        if (disabled) {
            cls += " cell-disabled";
            disabledDates.add(dt.toISOString().slice(0, 10));
        } else {
            const param = `${dt.getUTCFullYear()}, ${dt.getUTCMonth()}, ${dt.getUTCDate()}`;
            interactive = ` onclick="pickDay(${param})" onmouseover="selDay(${param})"`;
        }
        if (capacity > 1)
            interactive += ` title="${ocMin}/${capacity} belegt"`;

        // print cell
        html += `<td data-idx="${i}" class="${cls}"${interactive} style="${style}"><div class="day-label">${dt.getUTCDate()}</div></td>\n`;
    }

    document.getElementById("table").innerHTML = html + "</tr></tbody></table>";
}

function getCalendarWeek(date) {
    const tempDate = new Date(date);
    incUTCDate(tempDate, 3 - ((tempDate.getUTCDay() + 6) % 7));
    const firstThursday = new Date(tempDate.getUTCFullYear(), 0, 4);
    incUTCDate(firstThursday, 3 - ((firstThursday.getUTCDay() + 6) % 7));
    return 1 + Math.round(((tempDate - firstThursday) / 86400000 - 3) / 7);
}

function getHSLColorFromOccupation(count, capacity) {
    const ratio = capacity == 0 ? 1 : Math.min(1, count / capacity);
    const hue = (1 - ratio) * 120; // grün (120) bis rot (0)
    const lightness = 85 - ratio * 30; // bei voll: dunkler
    return `hsl(${hue}, 100%, ${lightness}%)`;
}

function incUTCDate(date, delta) {
    date.setUTCDate(date.getUTCDate() + delta);
    return date;
}

changeMonth(0);
document.getElementById("tooltip").textContent = "Bitte Anreisedatum wählen.";