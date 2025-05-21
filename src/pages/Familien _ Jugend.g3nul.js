import { printEventSummary, filterAndSortEvents } from 'public/cms.js';

$w.onReady(function () {
    $w("#repeaterResults").onItemReady(async (item, data) => {
        printEventSummary(data._id, item("#textDescription"));
    });

    $w("#checkboxNoReservation").onChange(() => update());
    $w("#checkboxOnGround").onChange(() => update());
    $w("#checkboxNoPrice").onChange(() => update());
    $w("#checkboxAlsoPast").onChange(() => update());
    $w("#dropdownType").onChange(() => update());
    update();
});

function update() {
    filterAndSortEvents(true);
}