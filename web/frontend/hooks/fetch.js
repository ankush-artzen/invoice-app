//write a function that fetch payouts from shopify admin

const fetchPayouts = async () => {
    const response = await fetch("/api/payouts");
    return response.json();
}









