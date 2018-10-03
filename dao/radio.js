var mongoose = require('mongoose');
var RadioSchema = new mongoose.Schema({
    radioId : String,
    title : String,
    mediaUrl : String,
    status : Number,
    description : String,
    createdDate : Date,
    updatedDate : Date,
    createdUserId : String,
    updatedUserId : String
});
mongoose.model('Radios', RadioSchema);

module.exports = mongoose.model('Radios');