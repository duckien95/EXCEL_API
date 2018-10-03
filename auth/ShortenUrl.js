var alphabet = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ/-";
var base = alphabet.length; // base is the length of the alphabet (58 in this case)

function encodeUrl(num){
    console.log('num', num)
    var encoded = '';
    while (num){
        var remainder = num % base;
        num = Math.floor(num / base);
        encoded = alphabet[remainder].toString() + encoded;
    }
    return encoded;
};

function decodeUrl(num){
    var encoded = '';
    while (num){
        var remainder = num % base;
        num = Math.floor(num / base);
        encoded = alphabet[remainder].toString() + encoded;
    }
    return encoded;
}

module.exports = {
    encodeUrl: encodeUrl,
    decodeUrl: decodeUrl
}
