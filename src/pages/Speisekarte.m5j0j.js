import wixData from 'wix-data';

$w.onReady(function () {
    $w("#datasetFood").onReady(() => {
        wixData.query("Speisen").descending("date").find().then((results) => {
            $w("#tableFood").rows = results.items.map(item => {
                item.price = `${item.price.toFixed(2)} €`;
                return item;
            });
        });
    });
});