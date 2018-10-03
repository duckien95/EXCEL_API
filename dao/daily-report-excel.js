var mongoose = require('mongoose');

var DailyReportExcelSchema = new mongoose.Schema({
    date_time: Date,
    number_user: Number,
    number_file: Number,
    list_success: Object,
    list_error: Object
});

mongoose.model('DailyReportExcel', DailyReportExcelSchema);

module.exports = mongoose.model('DailyReportExcel');
