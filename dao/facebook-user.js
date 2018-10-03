var mongoose = require('mongoose');
mongoose.connect('mongodb://vtp_cms:VtpCmsXymn6@125.212.238.119:27017/vtp_cms', { useMongoClient: true });
var FacebookUserSchema = new mongoose.Schema({

   // name: String,
   // first_name : String,
   // last_name : String,
   // middle_name : String,
   // address: String,
   // hometown: String,
   // education: String,
   // gender: String,
   // location: String,
   // relationship_status: String,
   // age_range: [],
   // birthday: Date,
   // about: String,
   // email: String,
    user_id: {
        type: String,
        index: true
    },
    phone: {
        type: String,
        index: true
    },
    status: { type: Number, default: 0 },
    deactivate: Boolean,
    info: []
});

// FacebookUserSchema.index({ user_id: 1, phone: -1 });

mongoose.model('FacebookUser', FacebookUserSchema);

module.exports = mongoose.model('FacebookUser');
