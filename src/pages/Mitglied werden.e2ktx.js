$w.onReady(function () {
    const ranges = {
        "perYear": " pro Jahr",
        "firstYear": " für 1 Jahr",
        "": ""
    };
    $w("#datasetMemberPrices").onReady(async () => {
        const result = await $w("#datasetMemberPrices").getItems(0, $w("#datasetMemberPrices").getPageSize());
        $w("#tableMemberPrices").rows = result.items.map(item => ({
            ...item,
            price: item.price ? `${item.price.toFixed(2)} €${ranges[item.range ?? ""]}` : "",
        }));
    });

    $w("#datasetLeasingPrices").onReady(async () => {
        const result = await $w("#datasetLeasingPrices").getItems(0, $w("#datasetLeasingPrices").getPageSize());
        $w("#tableLeasingPrices").rows = result.items.map(item => ({ ...item, price: item.price ? `${item.price.toFixed(2)} €` : "" }));
    });

});