var mongoose = require('mongoose');
var ClientAppSchema = new mongoose.Schema({
    appId: String,
    secretKey: String
});
mongoose.model('ClientApp', ClientAppSchema);

module.exports = mongoose.model('ClientApp');