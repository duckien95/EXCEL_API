var mongoose = require('mongoose');

var UploadExelSchema = new mongoose.Schema({
   status: String,
   fileName: String,
   originalName: String,
   header: [],
   inventory: Object,
   content: [
      // {
      //    order: {},
      //    NLP: {},
      //    index: Number,
      //    status: String
      // }
   ],
   cusId : String,
   rowCount: Number,
   GUI_ID: String,
   uploadTime: Date,
   token: String
});

mongoose.model('UploadExel', UploadExelSchema);

module.exports = mongoose.model('UploadExel');
