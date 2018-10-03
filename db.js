var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const MONGODB_USER = process.env.MONGODB_USER;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;
const MONGODB_IP_ADDRESS = process.env.MONGODB_IP_ADDRESS;
mongoose.connect(`mongodb://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_IP_ADDRESS}:27017/${MONGODB_DATABASE}`, { useMongoClient: true });
// mongoose.connect('mongodb://localhost:27017/cms', { useMongoClient: true });
// mongoose.connect('mongodb://125.212.238.130:27017/cms', { useMongoClient: true });
// mongoose.connect('mongodb://localhost:27017/local_vtdev', { useMongoClient: true });

// db.createUser(
//   {
//     user: "vtp_cms",
//     pwd: "VtpCmsXymn6",
//     roles: [ { role: "readWrite", db: "vtp_cms" } ]
//   }
// )
