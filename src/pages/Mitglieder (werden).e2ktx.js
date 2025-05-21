import wixData from 'wix-data';

$w.onReady(function () {
    $w("#datasetMemberPrices").onReady(() => {
        wixData.query("pricesMembers").descending("price").find().then((results) => {
            $w("#tableMemberPrices").rows = results.items.map(item => {
                const range = (() => {
                    switch (item.range) {
                    case "perYear":
                        return " pro Jahr";
                    case "firstYear":
                        return " für 1 Jahr";
                    default:
                        return "";
                    }
                })();
                item.price = `${item.price.toFixed(2)} €${range}`;
                return item;
            });
        });
    });
    $w("#datasetLeasingPrices").onReady(() => {
        wixData.query("pricesLeasing").ascending("price").find().then((results) => {
            $w("#tableLeasingPrices").rows = results.items.map(item => {
                item.price = `${item.price.toFixed(2)} €`;
                return item;
            });
        });
    });
});