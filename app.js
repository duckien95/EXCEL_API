var express = require('express');
var app = express();
var cors = require('cors');
var path = require('path');
var db = require('./db');
global.__root   = __dirname + '/';

app.get('/api', function (req, res) {
  res.status(200).send('API works.................');
});

app.get('/download/:code', function(req, res) {
    console.log(req.params.code);
    let buff = new Buffer(req.params.code, 'base64');
    console.log(buff.toString('ascii'));
    res.redirect(buff.toString('ascii'));
});

app.use(express.static(path.join(__root, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
     if(req.method == "OPTIONS"){
          return res.status(200).json({});
     }
  next();
});

app.get('/', function( req, res){
   res.redirect('/xlsx/employee.xlsx')
})

var AuthController = require(__root + 'auth/AuthController');
app.use('/api/auth', AuthController);

var WebController  = require(__root + 'vtp_cms_api/WebController');
app.use('/api/web', WebController);

var BannerController  = require(__root + 'vtp_cms_api/BannerController');
app.use('/api/banner', BannerController);

var BannerItemController  = require(__root + 'vtp_cms_api/BannerItemController');
app.use('/api/item-banner', BannerItemController);

var ServiceController  = require(__root + 'vtp_cms_api/ServiceController');
app.use('/api/service', ServiceController);

var PostController  = require(__root + 'vtp_cms_api/PostController');
app.use('/api/post', PostController);

var UserController  = require(__root + 'vtp_cms_api/UserController');
app.use('/api/user', UserController);

var EmployeeController  = require(__root + 'vtp_cms_api/EmployeeController');
app.use('/api/employee', EmployeeController);

var NoteController  = require(__root + 'vtp_cms_api/NoteController');
app.use('/api/note', NoteController);


var UploadExelController  = require(__root + 'vtp_cms_api/UploadExelController');
app.use('/api/excel', UploadExelController);

var ExcelWebController  = require(__root + 'vtp_cms_api/ExcelWebController');
app.use('/api/web-excel', ExcelWebController);

var CMSAPI = require(__root + 'vtp_cms_api/WebController');
app.use('/api/cms', CMSAPI);

var RadioAPI = require(__root + 'vtp_cms_api/RadioController');
app.use('/api/radio', RadioAPI);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at: Promise %s %s', JSON.stringify(promise), reason)
});

module.exports = app;
