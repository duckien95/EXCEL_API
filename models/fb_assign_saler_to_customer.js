var mongoose = require('mongoose');

var FbAssignCustomerSchema = new mongoose.Schema({
    id: String,
    // id = channelId_pageId_vtsaleUserId
    page_id: String,
    channel_id: Number,
    vtsale_user: {
        id: Number,
        name: String,
        avatar: String
    },
    fb_users: [{
        id: Number,
        name: String,
        avatar: String
    }],
    created_time: Date,
    updated_time: Date
},{
    collection: 'fb_assign_saler_to_customer'
});

mongoose.model('FbAssignSalerToCustomer', FbAssignCustomerSchema);

module.exports = mongoose.model('FbAssignSalerToCustomer');
