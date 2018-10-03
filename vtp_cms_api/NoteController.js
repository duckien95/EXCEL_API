var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var verify = require('../auth/VerifyToken');
var RegisterAgency = require('../dao/register-agency');
var OfferPrice = require('../dao/offer-price');
var ConsultService = require('../dao/consult-service');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());


// **************************REGISTER AGENCY**********************************
router.post('/list_register_agency', verify.verifyAppToken, function (req, res) {
   RegisterAgency.find().exec(function( err, agency) {
      if(err) return res.status(500).send({ message: 'Can not connect to server', error: true });
      res.status(200).send({ message: "success", error: false, data: agency });
   })
});

router.post('/get_register_agency_by_id',  verify.verifyAppToken, function (req, res) {
   if(req.body.registerAgencyId == undefined){
      return res.status(200).send({ message: 'Register Agency Id is undefined', error: true });
   }

   RegisterAgency.findOne({_id: req.body.registerAgencyId}).exec(function (err, agency) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(agency == null) return res.status(200).send({ message: "Agency not exist", error: true });
      // if get register agency success
      res.status(200).send({ message: "success", error: false, data: agency });
   })
});

router.post('/register_agency_update',  verify.verifyAppToken, function (req, res) {
   console.log(req.body.note);
   if(req.body._id == undefined){
      return res.status(200).send({ message: 'Register Agency Id is undefined', error: true });
   }

   RegisterAgency.findOneAndUpdate({_id: req.body._id}, { status: req.body.status, note: req.body.note }).exec(function (err, agency) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(agency == null) return res.status(200).send({ message: "Agency not exist", error: true });
      // if get register agency success
      res.status(200).send({ message: "success", error: false, data: agency });
   })
});

router.post('/register_agency_search', verify.verifyAppToken, function(req, res){
   var { phone, fullName, address, job, registerAgencyAddress, personalOrBusinessRegisterId, fromStartDate, toStartDate, status  } = req.body;
   console.log(req.body);
   var searchQuery = {};

   // searchQuery.startDate = {"$lt": new Date(2018,7,16)};
   if(status != undefined && status > 0){
      searchQuery.status = status;
   }
   if(verify.IsNotEmptyOrUndefined(address)) {
      searchQuery.address = new RegExp(address.trim());
   }

   if(verify.IsNotEmptyOrUndefined(fullName)) {
      searchQuery.fullName = new RegExp(fullName.trim());
   }

   if(verify.IsNotEmptyOrUndefined(job)) {
      searchQuery.job = new RegExp(job.trim());
   }

   if(verify.IsNotEmptyOrUndefined(phone)) {
      phone = phone.replace(/\s+/g, '');
      searchQuery.phone = new RegExp(phone.trim());
   }

   if(personalOrBusinessRegisterId != undefined && personalOrBusinessRegisterId.trim() != '') {
      searchQuery.personalOrBusinessRegisterId = new RegExp(personalOrBusinessRegisterId.trim());
   }

   if(registerAgencyAddress != undefined && registerAgencyAddress.trim() != '') {
      searchQuery.registerAgencyAddress = new RegExp(registerAgencyAddress.trim());
   }

   //find start date between
   if(verify.IsNotEmptyOrUndefined(fromStartDate) || verify.IsNotEmptyOrUndefined(toStartDate)){
      searchQuery.startDate = {};
      if(verify.IsNotEmptyOrUndefined(fromStartDate)) searchQuery.startDate['$gte']  = new Date(fromStartDate);
      if(verify.IsNotEmptyOrUndefined(toStartDate)) searchQuery.startDate['$lt']  = new Date(toStartDate);
   }

   console.log(searchQuery);

   RegisterAgency.find(searchQuery).exec(function (err, radio) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if find radio success
      res.status(200).send({ message: "success", error: false, data: radio });
   })
});

// **************************OFFER PRICE**********************************
router.post('/list_offer_price',  verify.verifyAppToken, function (req, res) {
   OfferPrice.find().exec(function( err, offerPrice) {
      if(err) return res.status(500).send({ message: 'Can not connect to server', error: true });
      res.status(200).send({ message: "success", error: false, data: offerPrice });
   })
});

router.post('/get_offer_price_by_id',  verify.verifyAppToken, function (req, res) {
   if(req.body.offerPriceId == undefined){
      return res.status(200).send({ message: 'Offer Price Id is undefined', error: true });
   }

   OfferPrice.findOne({_id: req.body.offerPriceId}).exec(function (err, offer) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(offer == null) return res.status(200).send({ message: "Radio not exist", error: true });
      // if get offer price success
      res.status(200).send({ message: "success", error: false, data: offer });
   })
});

router.post('/offer_price_update',  verify.verifyAppToken, function (req, res) {
   console.log(req.body.note);
   if(req.body._id == undefined){
      return res.status(200).send({ message: 'Offer Price Id is undefined', error: true });
   }

   OfferPrice.findOneAndUpdate({_id: req.body._id}, { status: req.body.status, note: req.body.note }).exec(function (err, offer) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(offer == null) return res.status(200).send({ message: "Offer Price not exist", error: true });
      // if get offer price success
      res.status(200).send({ message: "success", error: false, data: offer });
   })
});


router.post('/offer_price_search', verify.verifyAppToken, function(req, res){
   var { fullName, phone, status, departurePlace, destinationPlace, service } = req.body;
   console.log(req.body);
   var searchQuery = {};
   if(status != undefined && status > 0){
      searchQuery.status = status;
   }
   if(verify.IsNotEmptyOrUndefined(fullName)) {
      searchQuery.fullName = new RegExp(fullName.trim());
   }

   if(verify.IsNotEmptyOrUndefined(phone)) {
      phone = phone.replace(/\s+/g, '');
      searchQuery.phone = new RegExp(phone.trim());
   }

   if(verify.IsNotEmptyOrUndefined(departurePlace)) {
      searchQuery.departurePlace = new RegExp(departurePlace.trim());
   }

   if(verify.IsNotEmptyOrUndefined(destinationPlace)) {
      searchQuery.destinationPlace = new RegExp(destinationPlace.trim());
   }

   if(verify.IsNotEmptyOrUndefined(service)) {
      searchQuery.service = new RegExp(service.trim());
   }


   console.log(searchQuery);

   OfferPrice.find(searchQuery).exec(function (err, offerPrice) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if find offer price success
      res.status(200).send({ message: "success", error: false, data: offerPrice });
   })
});

// ************************** CONSULT SERVICE **********************************

router.post('/list_consult_service',  verify.verifyAppToken, function (req, res) {
   ConsultService.find().exec(function( err, consultService) {
      if(err) return res.status(500).send({ message: 'Can not connect to server', error: true });
      res.status(200).send({ message: "success", error: false, data: consultService });
   })
});

router.post('/get_consult_service_by_id',  verify.verifyAppToken, function (req, res) {
   if(req.body.consultServiceId == undefined){
      return res.status(200).send({ message: 'Consult Service Id is undefined', error: true });
   }

   ConsultService.findOne({_id: req.body.consultServiceId}).exec(function (err, consultService) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(consultService == null) return res.status(200).send({ message: "Consult service not exist", error: true });
      // if get consult service success
      res.status(200).send({ message: "success", error: false, data: consultService });
   })
});

router.post('/consult_service_update',  verify.verifyAppToken, function (req, res) {
   console.log(req.body.note);
   if(req.body._id == undefined){
      return res.status(200).send({ message: 'Consult Service Id is undefined', error: true });
   }

   ConsultService.findOneAndUpdate({_id: req.body._id}, { status: req.body.status, note: req.body.note }).exec(function (err, consultService) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });
      if(consultService == null) return res.status(200).send({ message: "Consult service not exist", error: true });
      // if get consult service success
      res.status(200).send({ message: "success", error: false, data: consultService });
   })
});

router.post('/consult_service_search', verify.verifyAppToken, function(req, res){
   var { fullName, phone, address, title, status } = req.body;
   console.log(req.body);
   var searchQuery = {};
   if(status != undefined && status > 0){
      searchQuery.status = status;
   }
   if(fullName != undefined && fullName.trim() != '') {
      searchQuery.fullName = new RegExp(fullName.trim());
   }

   if(phone != undefined && phone.trim() != '') {
      phone = phone.replace(/\s+/g, '');
      searchQuery.phone = new RegExp(phone.trim());
   }

   if(address != undefined && address.trim() != '') {
      searchQuery.address = new RegExp(address.trim());
   }

   if(title != undefined && title.trim() != '') {
      searchQuery.title = new RegExp(title.trim());
   }

   console.log(searchQuery);

   ConsultService.find(searchQuery).exec(function (err, consult) {
      if (err) return res.status(500).send({ message: "Can not connect to server", error: true });

      // if find consult success
      res.status(200).send({ message: "success", error: false, data: consult });
   })
});

router.post('/generate',  verify.verifyAppToken, function (req, res) {
   for (var i = 0; i < 50; i++) {
      RegisterAgency.create({
         fullName : 'Nguyen Van A' + i,
         email : i + '@gmail.com',
         phone : '01234567' + i + (i + 1),
         address : i + 'Minh Khai, Hai Bà Trưng, Hà Nội',
         personalOrBusinessRegisterId : "00300400" + i + '00' + (i + 1),
         issuedDate : new Date(),
         issuedPlace: "Hai Bà Trưng, Hà Nội",
         createdUserId : req.clientAppId,
         job: "Saler" + i,
         registerAgencyAddress: "N2, Viettel Post" + i,
         totalSquare: 300,
         length: 10,
         width: 30,
         height: 5,
         startDate: new Date(),
         note: '',
         status: 1
      }, function(err, register){
         console.log('add register agency');
      });
      // ConsultService.create({
      //    fullName : 'Nguyen Van A' + i,
      //    email : i + '@gmail.com',
      //    phone : '01234567' +  i + (i + 1),
      //    address : i + 'Minh Khai, Hai Bà Trưng, Hà Nội',
      //    title: 'title' + i,
      //    content: 'content' + i,
      //    note: '',
      //    status: 1
      // }, function(err, register){
      //    console.log('add consult service');
      // })

      // OfferPrice.create({
      //    fullName : 'Nguyen Van A' + i,
      //    email : i + '@gmail.com',
      //    phone : '0123456789',
      //    address : i + 'Minh Khai, Hai Bà Trưng, Hà Nội',
      //    service: "Vận tải nội địa " + (i + 1),
      //    unit: "Kiện",
      //    packageMaterial: "Thùng carton",
      //    length: 10 + i,
      //    width: 30 + i,
      //    height: 5 + i,
      //    departurePlace: "Hà Nội " + i,
      //    destinationPlace: "TP HCM " + i,
      //    timeTarget: 30 + i,
      //    temperatureRequired: 25 + i,
      //    priceRequired: 5000000,
      //    wareContent: "Đồ đông lạnh",
      //    note: '',
      //    status: 1
      // }, function(err, register){
      //    console.log('add offer price');
      // });
   }
});

router.post('/update',  verify.verifyAppToken, function (req, res) {
   for (var i = 0; i < 20; i++) {
      // RegisterAgency.create({
      //    fullName : 'Nguyen Van A' + i,
      //    email : i + '@gmail.com',
      //    phone : '0123456789',
      //    address : i + 'Minh Khai, Hai Bà Trưng, Hà Nội',
      //    pesonalOrBusinessRegisterId : "003004005",
      //    issuedDate : new Date(),
      //    issuedPlace: "Hai Bà Trưng, Hà Nội",
      //    createdUserId : req.clientAppId,
      //    job: "Saler",
      //    registerAgencyAddress: "N2, Viettel Post",
      //    totalSquare: 300,
      //    length: 10,
      //    width: 30,
      //    height: 5,
      //    startDate: new Date(),
      //    note: ''
      // }, function(err, register){
      //    console.log('add register agency');
      // });
      // ConsultService.create({
      //    fullName : 'Nguyen Van A' + i,
      //    email : i + '@gmail.com',
      //    phone : '0123456789',
      //    address : i + 'Minh Khai, Hai Bà Trưng, Hà Nội',
      //    title: 'title' + i,
      //    content: 'content' + i,
      //    note: ''
      // }, function(err, register){
      //    console.log('add consult service');
      // })

      // OfferPrice.findOneAndUpdate({ fullName : 'Nguyen Van A' + i }, { status: 0 }, function(err, register){
      //    console.log('update offer price');
      // });
   }

   OfferPrice.findOneAndUpdate({ fullName : 'Nguyen Van A1'  }, { new: true }, { $set : { other: 0 } }, function(err, register){
      console.log('update offer price');
      if(err) {
         return res.status(500).send({ err: err })
      } else {
         res.status(200).send({ data: register })
      }
   });
});


module.exports = router;
