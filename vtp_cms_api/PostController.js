var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var multer = require('multer');
var verify = require('../auth/VerifyToken');
var Post = require('../dao/post');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());


var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../VTPCMS/public/images')
  },
  filename: function (req, file, cb) {
     // console.log('file', file);
    cb(null, Date.now() + '.' + file.originalname.split('.')[1])
  }
});

const upload = multer({ storage });

router.post('/search', verify.verifyAppToken, function(req, res){
   console.log(req.body);
   var { title, status, fromPublishDate, toPublishDate } = req.body;
   var searchQuery = {};

   if(status != undefined && status > 0){
      searchQuery.status = status;
   }

   if( verify.IsNotEmptyOrUndefined(fromPublishDate)  || verify.IsNotEmptyOrUndefined(toPublishDate)){
      searchQuery.publishDate = {};
      if(verify.IsNotEmptyOrUndefined(fromPublishDate)) searchQuery.publishDate['$gte']  = fromPublishDate;
      if(verify.IsNotEmptyOrUndefined(toPublishDate)) searchQuery.publishDate['$lt']  = toPublishDate;
   }

   if(verify.IsNotEmptyOrUndefined(title)) {
      searchQuery.title = new RegExp(title.trim());
   }
   console.log(searchQuery);

   Post.find(searchQuery).exec(function (err, posts) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true, log: err });
      // if create banner success
      res.status(200).send({ message: "success", error: false, data: posts });
   })
});

router.post('/list_all', verify.verifyAppToken, function(req, res){

   let query = req.body.postId == undefined ? {} : {_id: req.body.postId};
   Post.find(query).exec(function (err, banners) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if create banner success
      res.status(200).send({ message: "success", error: false, data: banners });
   })
});

// router.post('/create', verify.verifyAppToken, upload.single('file'), function (req, res) {
//    var bodyRequest = req.body;
//    console.log(req.body);
//    console.log(req.file);
// });

router.post('/create', verify.verifyAppToken, function (req, res) {
   var bodyRequest = req.body;
   console.log(bodyRequest);
   Post.create({
      title : bodyRequest.title,
      content : bodyRequest.content,
      status : bodyRequest.status,
      thumbnailImage : bodyRequest.thumbnailImage,
      shortDescription : bodyRequest.shortDescription,
      description : bodyRequest.description,
      servicesId : bodyRequest.servicesId,
      publishDate : new Date(bodyRequest.publishDate),
      // publishDate : bodyRequest.publishDate,
      createdDate : new Date(),
      updatedDate : new Date(),
      createdUserId : req.clientAppId,
      updatedUserId : req.clientAppId
   }, function (err, callback) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true, data: err });
      if (callback == null){
         return res.status(200).send({ message: "error", error: true });
      }
      res.status(200).send({ message: "Create post success", error: false, data: callback});

   })
})

router.post('/update', verify.verifyAppToken, function (req, res) {
   var bodyRequest = req.body;
   console.log(bodyRequest);
   if(bodyRequest._id == undefined){
      return res.status(200).json({ message: 'Post id is undefined', error: true});
   }
   Post.findOneAndUpdate({ _id:  bodyRequest._id }, {
      title : bodyRequest.title,
      content : bodyRequest.content,
      status : bodyRequest.status,
      thumbnailImage : bodyRequest.thumbnailImage,
      shortDescription : bodyRequest.shortDescription,
      description : bodyRequest.description,
      servicesId : bodyRequest.servicesId,
      publishDate : new Date(bodyRequest.publishDate),
      // publishDate : bodyRequest.publishDate,
      updatedDate : new Date(),
      updatedUserId : req.clientAppId
   }).exec(function( err, callback){
      if (err) return res.status(500).json({ message: "Can not connect to server", error: true });
      if (callback == null){
         return res.status(200).json({ message: "Post not exist", error: true });
      }
      res.status(200).json({ message: "Update post success", error: false });

   })
})

router.post('/delete', verify.verifyAppToken, function( req, res) {
   // console.log(req.body);
   if(req.body.postId == undefined ){
      return res.status(200).send({message: "Post id is undefined", error: true });
   }

   Post.findOneAndRemove({ _id: req.body.postId }).exec(function (err, callback) {
      if(err) res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null) {
         return res.status(200).send({ message: "Post not exist", error: true });
      }
      res.status(200).send({ message: "Delete post success", error: false });


   })
})

module.exports = router;
