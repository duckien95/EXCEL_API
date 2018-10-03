var mongoose = require('mongoose');

var FbConvDetailSchema = new mongoose.Schema({
    _id: String,
    from: {},
    assign_to: {}
},{
    collection: 'fb_conv_detail'
});

mongoose.model('FbConversationDetail', FbConvDetailSchema);

module.exports = mongoose.model('FbConversationDetail');
