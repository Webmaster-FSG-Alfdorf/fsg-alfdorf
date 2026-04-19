import { CmsEditor, FilterType } from 'public/cms_edit.js';

$w.onReady(function () {
    const editor = new CmsEditor({
        cmsName: "sports",
        dataSetName: "datasetSports",
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),

        generateTitle: (item) => item?.name,

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

    //printDataSetSummary(sorted, " Sportart", "Sportarten", filtered);//TODO
    $w("#repeaterResults").onItemReady(async (item, data) => {
        //printSportSummary(data, item("#textDescription"));
    });

});