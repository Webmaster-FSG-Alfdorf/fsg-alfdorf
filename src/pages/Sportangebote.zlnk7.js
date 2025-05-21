import wixData from 'wix-data';

import { printDataSetSummary, printSportSummary } from 'public/cms.js';

$w.onReady(function () {
    $w("#repeaterResults").onItemReady(async (item, data) => {
        printSportSummary(data, item("#textDescription"));
    });


    $w("#checkboxAlltime").onChange(() => update());
    $w("#checkboxWeatherIndep").onChange(() => update());
    $w("#checkboxNoEquipment").onChange(() => update());
    $w("#checkboxNoPrice").onChange(() => update());
    $w("#checkboxOnGround").onChange(() => update());
    $w("#dropdownSeason").onChange(() => update());
    update();

    function update() {
        let filtered = false;
        let q = wixData.query("sports");

        if ($w("#checkboxOnGround").checked) {
            filtered = true;
            q = q.eq("onGround", true);
        }

        if ($w("#checkboxWeatherIndep").checked) {
            filtered = true;
            q = q.eq("weatherIndep", true);
        }

        if ($w("#checkboxAlltime").checked) {
            filtered = true;
            q = q.isEmpty("alltime");
        }

        if ($w("#checkboxNoPrice").checked) {
            filtered = true;
            q = q.isEmpty("price");
        }

        if ($w("#checkboxNoEquipment").checked) {
            filtered = true;
            q = q.isEmpty("ownEquipment"); //FIXME simple isEmpty check does not work here
        }

        const type = $w("#dropdownSeason").value;
        switch (type) {
        case "main":
        case "off":
            filtered = true;
            q = q.hasSome("season", [type]);
            break;
        }

        q.find().then((results) => {
            let res = results.items;
            const sorted = res.sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
            $w("#repeaterResults").data = sorted;
            printDataSetSummary(sorted, " Sportart", "Sportarten", filtered);
        }).catch((err) => console.log(`Cannot filter and sort data set:`, err));
    }

});