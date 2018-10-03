var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
// var VerifyToken = require('../auth/VerifyToken');
var verify = require('../auth/VerifyToken');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

var RadioSchedule = require('../dao/radioSchedule');
var Radio = require('../dao/radio');


/**
 * Configure JWT
 */
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var bcrypt = require('bcryptjs');
var config = require('../config'); // get config file


//************************************************ RADIO ************************************************

router.get('/active-radio', verify.verifyAppToken, function(req, resp) {
    /*RadioSchedule.findOne({ status: 1, publicDate : {$gte: Date.now} }, function (err, schedules) {
        if (err) return res.status(500).send('Error on the server.');
        if (!schedules) return res.status(404).send('No schedule found.');

        res.status(200).send({ status: "OK", schedule: schedules });
    });*/

    var activeRadio = {
        title: "Radio 1",
        radioUrl: "http://125.212.238.119:8001/"
    };
    resp.status(200).send({ status: "OK", radio: activeRadio });
});

router.post('/search', verify.verifyAppToken, function(req, res){
   var { title, description, status } = req.body;
   console.log(req.body);
   var searchQuery = {};
   if(status != undefined && status > 0){
      searchQuery.status = status;
   }

   if(verify.IsNotEmptyOrUndefined(title)) {
      searchQuery.title = new RegExp(title.trim());
   }

   if(verify.IsNotEmptyOrUndefined(description)) {
      searchQuery.description = new RegExp(description.trim());
   }

   console.log(searchQuery);

   Radio.find(searchQuery).exec(function (err, radio) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if find radio success
      res.status(200).send({ message: "success", error: false, data: radio });
   })
});

router.post('/list_all_radio', verify.verifyAppToken, function (req, res) {
   Radio.find().exec(function (err, radios) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if list radios not null
      res.status(200).send({ message: "success", error: false, data: radios });
   })
})

router.post('/get_radio_by_id', verify.verifyAppToken, function(req, res){
   if(req.body.radioId == undefined){
      return res.status(200).send({ message: 'Radio id is undefined', error: true });
   };

   Radio.findOne({_id: req.body.radioId}).exec(function (err, radio) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(radio == null) return res.status(200).send({ message: "Radio not exist", error: true });
      // if get radio success
      RadioSchedule.find({ radioId : req.body.radioId}).exec(function (err, schedule) {
         if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
         if(schedule == null) return res.status(200).send({ message: "Radio schedule not exist", error: true });
         // if get radio success
         res.status(200).send({ message: "success", error: false, radio: radio, schedule: schedule });
      })
      // res.status(200).send({ message: "success", error: false, data: radio });
   })
});

router.post('/create', verify.verifyAppToken, function(req, res){
   var bodyRequest = req.body;
   console.log(bodyRequest);
   Radio.create({
      title: bodyRequest.title,
      status: bodyRequest.status,
      description: bodyRequest.description,
      mediaUrl: bodyRequest.mediaUrl,
      createdDate: new Date(),
      updatedDate : new Date(),
      createdUserId : req.clientAppId,
      updatedUserId : req.clientAppId
   }, function(err, radio){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      res.status(200).send({ message: "Create radio success", error: false, radio: radio });
   })
})

router.post('/update', verify.verifyAppToken, function(req, res) {
   var bodyRequest = req.body;
   console.log(bodyRequest);
   if(bodyRequest._id == undefined){
      return res.status(200).send({ message: 'Radio id is undefined', error: true });
   }
   Radio.findOneAndUpdate({ _id:  bodyRequest._id },{
      title: bodyRequest.title,
      status : bodyRequest.status,
      mediaUrl: bodyRequest.mediaUrl,
      description: bodyRequest.description,
      updatedDate : new Date(),
      updatedUserId : req.clientAppId
   }).exec(function(err, callback){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if (callback == null) return res.status(200).send({ message: "Radio not exist", error: true });

      RadioSchedule.update({ radioId:  bodyRequest._id }, {
         title: bodyRequest.title,
         status : bodyRequest.status,
         description: bodyRequest.description,
         // updatedDate : new Date(),
         updatedUserId : req.clientAppId
      }, {multi: true}, function( err, callback){
         if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
         if (callback == null)
            return res.status(200).send({ message: "Radio schedule not exist", error: true });
         else
            // if update radio success
            res.status(200).send({ message: "Update radio and schedule success", error: false });
      })
   })
         // if update radio success
         // res.status(200).send({ message: "Update radio success", error: false });
})

router.post('/delete', verify.verifyAppToken, function( req, res) {
   console.log(req.body);
   if(req.body.radioId == undefined){
      return res.status(200).send({ message: 'Radio id is undefined', error: true });
   }

   Radio.findOneAndRemove({ _id: req.body.radioId }).exec(function (err, callback) {
      if(err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null) return res.status(200).send({ message: "Radio not exist", error: true });

      RadioSchedule.deleteMany({ radioId: req.body.radioId }, function (err, cb) {
         if(err) return res.status(500).send({ error: true, message: 'Remove radio success but not remove radio schedule fail' });
      })
      res.status(200).send({ message: "Remove radio success", error: false });
   })
})


//************************************************ RADIO SCHEDULE ************************************************

router.post('/schedule_search', verify.verifyAppToken, function(req, res){
   var { fromPublishDate, toPublishDate, status, radioId } = req.body;
   console.log('schedule_search',req.body);
   var searchQuery = {};

   if(status != undefined && status > 0){
      searchQuery.status = status;
   }

   if(verify.IsNotEmptyOrUndefined(radioId)){
      if (radioId.match(/^[0-9a-fA-F]{24}$/)) {
         searchQuery.radioId = radioId;
      }
      else {
         return res.status(200).send({message: "Radio Id is not valid", error: true});
      }
   }

   if( verify.IsNotEmptyOrUndefined(fromPublishDate)  || verify.IsNotEmptyOrUndefined(toPublishDate)){
      searchQuery.publicDate = {};
      if(verify.IsNotEmptyOrUndefined(fromPublishDate)) searchQuery.publicDate['$gte']  = new Date(fromPublishDate);
      if(verify.IsNotEmptyOrUndefined(toPublishDate)) searchQuery.publicDate['$lt']  = new Date(toPublishDate);
   }

   console.log(searchQuery);

   RadioSchedule.find(searchQuery, function (err, radioSchedule) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      res.status(200).send({ message: "success", error: false, data: radioSchedule });
   })
});

router.post('/list_all_schedule_radio', verify.verifyAppToken, function (req, res) {
   RadioSchedule.find().exec(function (err, radios) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      // if list radios not null
      res.status(200).send({ message: "success", error: false, data: radios });
   })
});

router.post('/get_schedule_radio_by_parent', verify.verifyAppToken, function(req, res){
   if(req.body.radioId == undefined){
      return res.status(200).send({ message: 'Radio schedule id is undefined', error: true });
   }

   RadioSchedule.find({ radioId: req.body.radioId}).exec(function (err, schedule) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(schedule == null) return res.status(200).send({ message: "Radio schedule not exist", error: true });
      // if get radio success
      res.status(200).send({ message: "success", error: false, data: schedule });
   })
});

router.post('/get_schedule_radio_by_id', verify.verifyAppToken, function(req, res){
   if(req.body.radioScheduleId == undefined){
      return res.status(200).send({ message: 'Radio schedule id is undefined', error: true });
   }

   RadioSchedule.findOne({_id: req.body.radioScheduleId}).exec(function (err, schedule) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(schedule == null) return res.status(200).send({ message: "Radio schedule not exist", error: true });
      // if get radio success
      res.status(200).send({ message: "success", error: false, data: schedule });
   })
});

router.post('/schedule_create', verify.verifyAppToken, function(req, res){
   var bodyRequest = req.body;
   console.log(req.body.publicDate);
   RadioSchedule.create({
      radioId: bodyRequest.radioId,
      title: bodyRequest.title,
      status: bodyRequest.status,
      description: bodyRequest.description,
      publicDate: new Date(bodyRequest.publicDate),
      createdDate: new Date(),
      updatedDate : new Date(),
      createdUserId : req.clientAppId,
      updatedUserId : req.clientAppId
   }, function(err, radioSchedule){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true, log: err });

      // if create radio schedule success
      res.status(200).send({ message: "Create radio schedule success", error: false, radioSchedule: radioSchedule });
   })
})

router.post('/schedule_update', verify.verifyAppToken, function(req, res) {
   var bodyRequest = req.body;
   console.log(req.body);
   if(bodyRequest._id == undefined){
      return res.status(200).send({ message: 'Radio schedule id is undefined', error: true });
   }
   RadioSchedule.findOneAndUpdate({ _id:  bodyRequest._id }, {
      status : bodyRequest.status,
      publicDate: new Date(bodyRequest.publicDate),
      updatedDate : new Date(),
      updatedUserId : req.clientAppId,
      // radioId: bodyRequest.radioId,
      // title: bodyRequest.title,
      // mediaUrl: bodyRequest.mediaUrl,
      // description: bodyRequest.description,

   }).exec(function( err, callback){
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true, log: err });
      if (callback == null)
         return res.status(200).send({ message: "Radio schedule not exist", error: true });
      else
         // if update radio success
         res.status(200).send({ message: "Update radio schedule success", error: false });
   })
})

router.post('/schedule_delete', verify.verifyAppToken, function( req, res) {
   if(req.body.radioScheduleId == undefined){
      return res.status(200).send({ message: 'Radio schedule id is undefined', error: true });
   }
   RadioSchedule.findOneAndRemove({ _id: req.body.radioScheduleId }).exec(function (err, callback) {
      if(err) res.status(500).send({ message: "Can not connect to server", error: true });
      if(callback == null)
         return res.status(200).send({ message: "Radio schedule not exist", error: true });
      else
         // if delete radio schedule success
         res.status(200).send({ message: "Delete radio schedule success", error: false });
   })
})

module.exports = router;
