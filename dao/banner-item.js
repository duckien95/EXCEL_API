var mongoose = require('mongoose');
var BannerItemSchema = new mongoose.Schema({
   bannerItemId : String,
   bannerItemName: String,
   bannerId: String,
   targetUrl: String,
   imageUrl: String,
   backgroundRGB: String,
   status : Number,
   backgroundRGB: String,
   isDefault: Boolean,
   priority: Number,
   startDate: Date,
   endDate: Date,
   createdDate : Date,
   updatedDate : Date,
   createdUserId : String,
   updatedUserId : String
});

mongoose.model('BannerItem', BannerItemSchema);

module.exports = mongoose.model('BannerItem');
