var mongoose = require('mongoose');

var FileManagementSchema = new mongoose.Schema({
    create_time: Date,
    path: String
});

mongoose.model('FileManagement', FileManagementSchema);

module.exports = mongoose.model('FileManagement');
