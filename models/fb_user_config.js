var mongoose = require('mongoose');

var FbUserConfigSchema = new mongoose.Schema({
    id: String,// id = pageId_channelId_vtsaleUserId
    page_id: Number,
    channel_id: Number,
    created_by: Number, //vtsale_user_id
    group_conversation: []
},{
    collection: 'fb_user_config'
});

mongoose.model('FbUserConfig', FbUserConfigSchema);

module.exports = mongoose.model('FbUserConfig');
