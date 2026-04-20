import { CmsEditor, FilterType } from 'public/cms_edit.js';

$w.onReady(function () {
    const editor = new CmsEditor({
        cmsName: "sports",
        dataSetName: "datasetSports",
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),

        translatedMessages: {
            itemName: "Sportangebot",
            itemNamePlural: "Sportangebote",
            repeaterSummaries: {
                one: "1 passendes {itemName}", //TODO untested
            },
        },

        generateTitle: (item) => item?.name,

        onRepeaterItemReady: ($item, rowData) => {
            let html = "<ul>";
            html += rowData.description ?? "";
            if (rowData.ownEquipment) html += `<li>🎽 ${rowData.ownEquipment}`;
            if (rowData.price) html += `<li>💶 ${rowData.price}`;
            if (rowData.contact) html += `<li>👤 ${rowData.contact}`
            $item("#textDescription").html = html + "</ul>";
        },

        filterSortField: "name",
        filterSchema: {
            "#checkboxOnGround": {
                type: FilterType.EQ,
                skip: (val) => !val,
                field: "onGround"
            },
            "#checkboxWeatherIndep": {
                type: FilterType.EQ,
                skip: (val) => !val,
                field: "weatherIndep"
            },
            "#checkboxNoReservation": {
                type: FilterType.IS_EMPTY,
                field: "alltime"
            },
            "#checkboxNoPrice": {
                type: FilterType.IS_EMPTY,
                field: "price"
            },
            "#checkboxNoEquipment": {
                type: FilterType.IS_EMPTY,  //FIXME simple isEmpty check does not work here
                field: "ownEquipment"
            },
            "#dropdownSeason": {
                type: FilterType.HAS_SOME,
                skip: (val) => val == "all",
                field: "season"
            },
        },
    });

    editor.init();
});