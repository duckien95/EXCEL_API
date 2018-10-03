var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var verify = require('../auth/VerifyToken');
var Banner = require('../dao/banner');
var BannerItem = require('../dao/banner-item');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

router.post('/search', verify.verifyAppToken, function(req, res){
   var { bannerItemName, status, isDefault, priority, fromStartDate, toStartDate, fromEndDate, toEndDate, bannerId } = req.body;
   console.log(req.body);
   var searchQuery = {};
   searchQuery.bannerId = bannerId;

   if(status != undefined && status > 0){
      searchQuery.status = status;
   }

   //find start date between
   if(verify.IsNotEmptyOrUndefined(fromStartDate) || verify.IsNotEmptyOrUndefined(toStartDate)){
      searchQuery.startDate = {};
      if(verify.IsNotEmptyOrUndefined(fromStartDate)) searchQuery.startDate['$gte']  = new Date(fromStartDate);
      if(verify.IsNotEmptyOrUndefined(toStartDate)) searchQuery.startDate['$lt']  = new Date(toStartDate);
   }
   // find end date between
   if( verify.IsNotEmptyOrUndefined(fromEndDate)  || verify.IsNotEmptyOrUndefined(toEndDate)){
      searchQuery.endDate = {};
      if(verify.IsNotEmptyOrUndefined(fromEndDate)) searchQuery.endDate['$gte']  = new Date(fromEndDate);
      if(verify.IsNotEmptyOrUndefined(toEndDate)) searchQuery.endDate['$lt']  = new Date(toEndDate);
   }

   if(priority != undefined && priority > 0){
      searchQuery.priority = priority;
   }

   if(isDefault != undefined && isDefault > 0){
      searchQuery.isDefault = isDefault;
   }

   if(verify.IsNotEmptyOrUndefined(bannerItemName)) {
      searchQuery.bannerItemName = new RegExp(bannerItemName.trim());
   }
   console.log(searchQuery);

   BannerItem.find(searchQuery).exec(function (err, banners) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if create banner success
      res.status(200).send({ message: "success", error: false, data: banners });
   })
});

router.post('/list_all', verify.verifyAppToken, function(req, res){
   query = req.body.bannerItemId == undefined ? {} : { _id: req.body.bannerItemId };
   BannerItem.find(query).exec(function (err, items){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if create banner item success
      res.status(200).send({ message: "success", error: false, data: items});
   })
})

router.post('/get_by_id', verify.verifyAppToken, function( req, res) {
   var bodyRequest = req.body;
   if(bodyRequest.bannerItemId == undefined || bodyRequest.bannerId == undefined){
      return res.status(200).send({message: "BannerId and BannerItemId is undefined", error: true });
   }
   BannerItem.findOne({ _id: bodyRequest.bannerItemId }).exec(function( err, items) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if create banner item success
      Banner.findOne({ _id: bodyRequest.bannerId }, function( err, banner) {
         if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
         res.status(200).send({ message: "success", error: false, bannerItem: items, banner: banner});
      })

   })
})

router.post('/list_child', verify.verifyAppToken, function( req, res) {
   // console.log('list_child');
   var bodyRequest = req.body;
   if(bodyRequest.bannerId == undefined){
      return res.status(200).send({message: "Banner id is undefined", error: true });
   }
   BannerItem.find({ 'bannerId': bodyRequest.bannerId }).exec(function( err, items) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if create banner item success
      res.status(200).send({ message: "success", error: false, data: items});
   })
})

router.post('/create', verify.verifyAppToken, function(req, res){

   var bodyRequest = req.body;
   BannerItem.create({
      bannerItemName: bodyRequest.bannerItemName,
      bannerId: bodyRequest.bannerId,
      status : bodyRequest.status,
      targetUrl : bodyRequest.targetUrl,
      imageUrl : bodyRequest.imageUrl,
      backgroundRGB: bodyRequest.backgroundRGB,
      isDefault: bodyRequest.isDefault,
      priority: bodyRequest.priority,
      startDate: bodyRequest.startDate == '' ? '' : new Date(bodyRequest.startDate),
      endDate: bodyRequest.endDate == '' ? '' : new Date(bodyRequest.endDate),
      updatedDate : new Date(),
      createdDate: new Date(),
      createdUserId : req.clientAppId,
      updatedUserId : req.clientAppId
   }, function(err, bannerItemObject){

      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if create banner item success
      res.status(200).send({ message: "Create banner item success", error: false, banner: bannerItemObject });
   })
});

router.post('/update', verify.verifyAppToken, function(req, res) {
   var bodyRequest = req.body;
   if(bodyRequest._id == undefined){
      return res.status(200).send({message: "Banner item id undefined", error: true });
   }
   BannerItem.findOneAndUpdate({ _id:  bodyRequest._id }, {
      bannerItemName: bodyRequest.bannerItemName,
      bannerId: bodyRequest.bannerId,
      status : bodyRequest.status,
      targetUrl : bodyRequest.targetUrl,
      imageUrl : bodyRequest.imageUrl,
      backgroundRGB: bodyRequest.backgroundRGB,
      isDefault: bodyRequest.isDefault,
      priority: bodyRequest.priority,
      startDate: bodyRequest.startDate == '' ? '' : new Date(bodyRequest.startDate),
      endDate: bodyRequest.endDate == '' ? '' : new Date(bodyRequest.endDate),
      updatedDate : new Date(),
      updatedUserId : req.clientAppId
   }).exec(function( err, callback){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null)
         res.status(200).send({ message: "Banner item not exist", error: true });
      else
         res.status(200).send({ message: "Update banner item success", error: false });
   })
})


router.post('/delete', verify.verifyAppToken, function( req, res) {
   var bodyRequest = req.body;
   if(bodyRequest.bannerItemId == undefined){
      return res.status(200).send({message: "Banner item id undefined", error: true });
   }

   BannerItem.findOneAndRemove({ _id: bodyRequest.bannerItemId }).exec( function(err, callback) {
      if(err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null)
         res.status(200).send({ message: "Banner item not exist", error: true });
      else
         res.status(200).send({ message: "Delete banner item success", error: false });
   })
})

module.exports = router;
