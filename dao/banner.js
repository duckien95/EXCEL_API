var mongoose = require('mongoose');
var BannerSchema = new mongoose.Schema({
   bannerId : String,
   bannerName: String,
   status : Number,
   backgroundRGB: String,
   createdDate : Date,
   updatedDate : Date,
   createdUserId : String,
   updatedUserId : String
});

mongoose.model('Banner', BannerSchema);

module.exports = mongoose.model('Banner');
