var mongoose = require('mongoose');
var RadioScheduleSchema = new mongoose.Schema({
    scheduleId : String,
    radioId : String,
    title : String,
    status : Number,
    description : String,
    publicDate: Date,
    createdDate : Date,
    updatedDate : Date,
    createdUserId : String,
    updatedUserId : String
});
mongoose.model('RadioSchedules', RadioScheduleSchema);

module.exports = mongoose.model('RadioSchedules');