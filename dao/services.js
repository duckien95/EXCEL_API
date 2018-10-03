var mongoose = require('mongoose');
var ServicesSchema = new mongoose.Schema({
   serviceId : String,
   name : String,
   logo : String,
   description : String,
   parentId : String,
   url : String,
   displayOrder : Number,
   status : Number,
   displayOnHome : Boolean,
   isHighLight : Boolean,
   isNews : Boolean,
   createdDate : Date,
   updatedDate : Date,
   createdUserId : String,
   updatedUserId : String
});
mongoose.model('Services', ServicesSchema);

module.exports = mongoose.model('Services');
