var mongoose = require('mongoose');
mongoose.connect('mongodb://vtpcrawler:123456a%40@125.212.238.119:27017/vtpcrawler', { useMongoClient: true });
var FacebookUserCrawler = new mongoose.Schema({
    _id: String,
    name: String,
    verification_status : String,
    location: Object,
    link: String,
    is_unclaimed: Boolean
}, {
    collection: 'facebookPage'
});

mongoose.model('FacebookUserCrawler', FacebookUserCrawler);

module.exports = mongoose.model('FacebookUserCrawler');
