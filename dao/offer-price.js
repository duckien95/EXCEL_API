var mongoose = require('mongoose');
var OfferPriceSchema = new mongoose.Schema({
    offerPriceId : String,
    fullName : String,
    email : String,
    phone : String,
    address : String,
    service: String,
    unit: String,
    packageMaterial: String,
    weight : Number,
    length: Number,
    width: Number,
    height: Number,
    departurePlace: String,
    destinationPlace: String,
    timeTarget: Number,
    temperatureRequired: String,
    priceRequired: Number,
    wareContent: String,
    status: Number,
    note: String,
    other: Number
});
mongoose.model('OfferPrice', OfferPriceSchema);

module.exports = mongoose.model('OfferPrice');
