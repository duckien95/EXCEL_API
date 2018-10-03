var mongoose = require('mongoose');
var RegisterAgencySchema = new mongoose.Schema({
    registerAgencyId : String,
    fullName : String,
    email : String,
    phone : String,
    address : String,
    personalOrBusinessRegisterId : String,
    issuedDate : Date,
    issuedPlace: String,
    createdUserId : String,
    job: String,
    registerAgencyAddress: String,
    totalSquare: Number,
    length: Number,
    width: Number,
    height: Number,
    startDate: Date,
    note: String,
    status: Number
});
mongoose.model('RegisterAgency', RegisterAgencySchema);

module.exports = mongoose.model('RegisterAgency');
