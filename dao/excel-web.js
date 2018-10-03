var mongoose = require('mongoose');

var ExcelWebSchema = new mongoose.Schema({
   status: String,
   fileName: String,
   originalName: String,
   header: [],
   inventory: Object,
   content: [],
   cusId : String,
   rowCount: Number,
   GUI_ID: String,
   uploadTime: Date,
   token: String
}, {
    collection: 'excel_web'
});

module.exports = mongoose.model('ExcelWeb', ExcelWebSchema);
