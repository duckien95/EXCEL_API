var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var verify = require('../auth/VerifyToken');
var Banner = require('../dao/banner');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

router.post('/list_all', verify.verifyAppToken, function(req, res){

   // let obj = req.body.bannerId == undefined ? {} : { _id: req.body.bannerId};
   Banner.find({}).exec(function (err, banners) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if create banner success
      res.status(200).send({ message: "success", error: false, data: banners });
   })
});

router.post('/get_by_id', verify.verifyAppToken, function(req, res){
   if(req.body.bannerId == undefined){
      return res.status(200).send({ message: 'Banner id is undefined', error: true });
   }
   Banner.findOne({_id: req.body.bannerId}).exec(function (err, banner) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if (banner == null) return res.status(200).send({ message: "Banner not exist", error: true });
      // if create banner success
      res.status(200).send({ message: "success", error: false, data: banner });
   })
});

router.post('/search', verify.verifyAppToken, function(req, res){
   var { id, bannerName, status } = req.body;
   console.log(req.body);
   var searchQuery = {};

   if(verify.IsNotEmptyOrUndefined(id)){
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
         searchQuery._id = id;
      }
      else {
         return res.status(200).send({message: "Banner Id is not valid", error: true});
      }
   }
   if(status != undefined && status > 0){
      searchQuery.status = status;
   }
   if(verify.IsNotEmptyOrUndefined(bannerName)) {
      searchQuery.bannerName = new RegExp(bannerName.trim());
   }

   console.log(searchQuery);

   Banner.find(searchQuery).exec(function (err, banners) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if create banner success
      res.status(200).send({ message: "success", error: false, data: banners });
   })
});

router.post('/create', verify.verifyAppToken, function(req, res){
   var bodyRequest = req.body;
   Banner.create({
      bannerName: bodyRequest.bannerName,
      status : bodyRequest.status,
      backgroundRGB: bodyRequest.backgroundRGB,
      createdDate: new Date(),
      updatedDate : new Date(),
      createdUserId : req.clientAppId,
      updatedUserId : req.clientAppId
   }, function(err, bannerObject){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if create banner success
      res.status(200).send({ message: "Create banner success", error: false, banner: bannerObject });
   })
})

router.post('/update', verify.verifyAppToken, function(req, res) {
   var bodyRequest = req.body;
   if(bodyRequest._id == undefined){
      return res.status(200).send({ message: 'Banner id is undefined', error: true });
   }
   Banner.findOneAndUpdate({ _id:  bodyRequest._id }, {
      bannerName: bodyRequest.bannerName,
      status : bodyRequest.status,
      backgroundRGB: bodyRequest.backgroundRGB,
      updatedDate : new Date(),
      updatedUserId : req.clientAppId
   }).exec(function( err, callback){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if (callback == null)
         return res.status(200).send({ message: "Banner not exist", error: true });
      else
         res.status(200).send({ message: "Update banner success", error: false });
   })
})


router.post('/delete', verify.verifyAppToken, function( req, res) {
   if(req.body.bannerId == undefined){
      return res.status(200).send({ message: 'Banner id is undefined', error: true });
   }

   Banner.findOneAndRemove({ _id: req.body.bannerId }).exec(function (err, callback) {
      if(err) res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null)
         return res.status(200).send({ message: "Banner not exist", error: true });
      else
         res.status(200).send({ message: "Delete banner success", error: false });
   })
})

module.exports = router;
