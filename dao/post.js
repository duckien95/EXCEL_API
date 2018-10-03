var mongoose = require('mongoose');
var PostsSchema = new mongoose.Schema({
   postId : String,
   title : String,
   content : String,
   status : Number,
   thumbnailImage : String,
   shortDescription : String,
   description : String,
   servicesId : String,
   publishDate : Date,
   createdDate : Date,
   updatedDate : Date,
   createdUserId : String,
   updatedUserId : String
});

mongoose.model('Posts', PostsSchema);

module.exports = mongoose.model('Posts');
