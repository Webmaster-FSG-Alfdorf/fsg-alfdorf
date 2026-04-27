import { CmsEditor, FilterType } from 'public/cms_edit.js';
import { dateRangeToString, printRanges, incUTCDate } from 'public/cms.js';

export function displayEvents(youth = false) {
    const editor = new CmsEditor({
        cmsName: "events",
        dataSetName: "datasetEvents",

        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),

        translatedMessages: {
            itemName: "Event",
            itemNamePlural: "Events",
        },

        generateTitle: (item) => item?.title,

        onRepeaterItemReady: ($item, rowData) => {
            let html = "<ul>";
            if (rowData.address) html += `<li>🏠 ${rowData.address.formatted}`;
            if (rowData.price) html += `<li>💶 ${rowData.price}`;
            if (rowData.responsible) html += `<li>👤 ${rowData.responsible}`
            if (rowData.registration) html += `<li>📝 Vornameldung bis ${dateRangeToString(rowData.registration)}`;
            if (rowData.dates && rowData.dates.length > 0) {
                html += "<li>📅";
                rowData.dates.forEach((ed, i) => {
                    if (i > 0) html += "<br>";
                    html += printRanges(ed)
                });
            }
            $item("#textDescription").html = html + "</ul>";
        },

        filterSortResults: (a, b) => {
            const aMin = a.dates && a.dates.length > 0 ? Math.min(...a.dates.map(d => new Date(d.start))) : Infinity;
            const bMin = b.dates && b.dates.length > 0 ? Math.min(...b.dates.map(d => new Date(d.start))) : Infinity;
            return aMin - bMin;
        },
        filterSchema: {
            "#checkboxOnGround": {
                type: FilterType.EQ,
                skip: (val) => !val,
                field: "onGround"
            },
            "#checkboxNoReservation": {
                type: FilterType.IS_EMPTY,
                field: "alltime"
            },
            "#checkboxNoPrice": {
                type: FilterType.IS_EMPTY,
                field: "price"
            },
            "#dropdownType": {
                type: FilterType.HAS_SOME,
                skip: (val) => !val || val == "Alle",
                value: (val) => val == "Sport-Event" ? [val, "Sport-Turnier"] : [val],
                field: "type"
            },
            "#checkboxAlsoPast": {
                type: FilterType.CUSTOM,
                skip: (val) => val, // only apply if not checked
                onFilterResults: (items) => {
                    const now = new Date();
                    return items.filter(v => {
                        const firstStart = v.dates && v.dates.length > 0 ? new Date(v.dates[0].start) : null;
                        return firstStart && firstStart >= now;
                    });
                }
            },
            "youth-filter": {
                id: "",
                type: FilterType.EQ,
                field: "youth",
                value: true,
                skip: () => !youth,
                countsAsFiltered: false
            },
        },
    });

    editor.init();
}
