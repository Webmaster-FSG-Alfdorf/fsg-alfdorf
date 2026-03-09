$w.onReady(function () {
    $w("#datasetFoods").onReady(async () => {
        const result = await $w("#datasetFoods").getItems(0, $w("#datasetFoods").getPageSize());
        $w("#tableFood").rows = result.items.map(item => ({ ...item, price: item.price ? `${item.price.toFixed(2)} €` : "" }));
    });
});