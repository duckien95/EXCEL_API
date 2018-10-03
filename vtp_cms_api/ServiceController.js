var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var verify = require('../auth/VerifyToken');
var Service = require('../dao/services');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

router.post('/list_all', verify.verifyAppToken, function (req, res) {
   let obj = req.body.serviceId == undefined ? {} : {_id: req.body.serviceId};
   // console.log(req.body);
   // console.log(obj);
   Service.find(obj).exec( function (err, services) {
      // console.log('line 15', services.length);
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if create banner success

      if(services.length == 1){
         Service.find({ _id: services[0].parentId }, function( err, banner){
            // console.error(err);
            if (err) return res.status(200).send({  message: "success", error: false, data: services, parent: null });
            else return res.status(200).send({ message: "success", error: false, data: services, parent:  banner[0]});
         })
      }
      else return res.status(200).send({ message: "success", error: false, data: services });

   })
})

router.post('/list_sibling', verify.verifyAppToken, function(req, res) {
   console.log(req.body);
   if (req.body.serviceId == undefined) {
      return res.status(400).send({ error: true, message: 'ServiceId is undefined' });
   }
   Service.findById(req.body.serviceId).exec()
   .then( service => {
      if(!service) return res.status(200).send({ error: true, message: 'Service not found' });
      return Service.find({'parentId': service.parentId}).exec();
   }).then( sibling => {
      if(!sibling) return res.status(200).send({ error: true, message: 'Sibling not found' });
      res.status(200).send({ message: "success", error: false, data: sibling });
   }).catch( err => {
      return res.status(500).send({ message: "Can not connect to server", error: true });
   });
});

router.post('/list_parent', verify.verifyAppToken, function (req, res) {
   Service.find({ parentId: 0 }).exec(function (err, services) {
      if (err) return res.status(500).send({ message: "Error on the server.", error: true });
      if (!services) return res.status(404).send({ message: "No service found.", error: true });

      res.status(200).send({ message: 'success', error: false, data: services });
   });
});

router.post('/list_child', verify.verifyAppToken, function (req, res) {
   if(req.body.parentServiceId == undefined){
      return res.status(200).send({ message: "Child service not found", error: true });
   }
   Service.find({ parentId: req.body.parentServiceId }).exec(function (err, services) {
      if (err) return res.status(500).send({ message: "Error on the server.", error: true });
      if (!services) return res.status(404).send({ message: "No service found.", error: true });

      res.status(200).send({ message: 'success', error: false, data: services });
   });
});

router.post('/search', verify.verifyAppToken, function(req, res){
   // console.log(req.body);
   var { name, description, status } = req.body;
   var searchQuery = {};

   if(status != undefined && status > 0){
      searchQuery.status = status;
   }
   if(verify.IsNotEmptyOrUndefined(name)) {
      searchQuery.name = new RegExp(name.trim());
   }

   if(verify.IsNotEmptyOrUndefined(description)) {
      searchQuery.description = new RegExp(description.trim());
   }
   console.log(searchQuery);

   Service.find(searchQuery).exec(function (err, services) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true, log: err });
      // if create banner success
      res.status(200).send({ message: "success", error: false, data: services });
   })
});

router.post('/create', verify.verifyAppToken, function (req, res) {
   var bodyRequest = req.body;
   Service.create({
      name : bodyRequest.name,
      logo : bodyRequest.logo,
      description : bodyRequest.description,
      parentId : bodyRequest.parentId,
      url : bodyRequest.url,
      displayOrder : bodyRequest.displayOrder,
      status : bodyRequest.status,
      displayOnHome : bodyRequest.displayOnHome,
      isHighLight : bodyRequest.isHighLight,
      isNews : bodyRequest.isNews,
      createdDate : new Date(),
      updatedDate : new Date(),
      createdUserId : req.clientAppId,
      updatedUserId : req.clientAppId
   }, function(err, service){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if create banner success
      res.status(200).send({ message: "Create service success", error: false, data:  service});
   })

})

router.post('/update', verify.verifyAppToken, function(req, res) {
   var bodyRequest = req.body;
   if(bodyRequest.serviceId == undefined){
      return res.status(200).json({ message: 'Service id is undefined', error: true});
   }
   Service.findOneAndUpdate({ _id:  bodyRequest.serviceId }, {
      name : bodyRequest.name,
      logo : bodyRequest.logo,
      description : bodyRequest.description,
      parentId : bodyRequest.parentId,
      url : bodyRequest.url,
      displayOrder : bodyRequest.displayOrder,
      status : bodyRequest.status,
      displayOnHome : bodyRequest.displayOnHome,
      isHighLight : bodyRequest.isHighLight,
      isNews : bodyRequest.isNews,
      updatedDate : new Date(),
      updatedUserId : req.clientAppId
   }).exec( function( err, callback){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if (callback == null){
         res.status(200).send({ message: "Service not exist", error: true });
         return;
      }
      else {
         res.status(200).send({ message: "Update service success", error: false });
         return;
      }

   })
})


router.post('/delete', verify.verifyAppToken, function( req, res) {

   if(req.body.serviceId == undefined){
      return res.status(200).json({ message: 'Service id is undefined', error: true});
   }

   Service.findOneAndRemove({ _id: req.body.serviceId }).exec(function (err, callback) {
      if(err) res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null) {
         res.status(200).send({ message: "Service not exist", error: true });
         return;
      }

      else {
         res.status(200).send({ message: "Delete service success", error: false });
         return;
      }

   })
})

module.exports =  router;
