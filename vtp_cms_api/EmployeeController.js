var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var xlsx = require('node-xlsx');
var axios = require('axios');
var schedule = require('node-schedule')
var path = require('path');

var verify = require('../auth/VerifyToken');
var Employee = require('../dao/employee');
var Organization = require('../dao/organization');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

// ****************************** EMPLOYEE ******************************

router.post('/org-distinct/:orgLevel', function(req, res){
   Organization.find().distinct(req.params.orgLevel, function (err, users) {
      if(err) res.status(500).send({ message: "Can not connect to server"});
      res.status(200).send({data: users});
   })
})

router.post('/update-employee', function(req, res){
   console.log('start update');
   Organization.updateMany(
      { },
      { '$set': { activate: false }}
   ).exec(function (err, users) {
      if(err) return res.status(500).send({ message: "Can not connect to server", log: err});
      res.status(200).send({data: users});
   });

});


//get child where orgLevel = 7
function asyncGetChildOrg(index, ListOrg, res, date) {

   if (index < ListOrg.length) {
      Organization.find({ orgParentId : ListOrg[index].organizationId }).select('_id name organizationId').exec()
      .then(function (emp) {
         if(!emp) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
         emp = JSON.parse(JSON.stringify(emp));
         ListOrg[index]['children'] = emp;
         asyncGetChildLevelTwo(index, ListOrg, 0, emp, res, date);
      }).catch( err => {
         console.log(err);
         return res.status(500).send({ status: 500 , error: true, message: "Can not connect to server"});
      })
   } else {
      return res.status(200).send({ status: 200, error: false, message: "success", data: ListOrg});
   }
}

//get child where orgLevel = 8
function asyncGetChildLevelTwo(index, ListOrg, index_two, ListOrgTwo, res, date) {
   // console.log('ListOrgTwo.length = ',ListOrgTwo.length);
   if (index_two < ListOrgTwo.length) {
      Organization.find({ orgParentId: ListOrg[index]['children'][index_two].organizationId }).select('_id name organizationId').exec()
      .then( function(org) {
         // console.log(org);
         ListOrg[index]['children'][index_two]['children'] = org;
         asyncGetChildLevelTwo(index, ListOrg, index_two + 1, ListOrgTwo, res, date);
      }).catch( err => {
         console.log(err);
         return res.status(500).send({ status: 500 , error: true, message: "Can not connect to server"});
      })
   } else {

      if (index + 1 == ListOrg.length) {
         let finishDateTime = new Date();
         console.log('total time : ',finishDateTime.getTime() - date);
         return res.status(200).send({ status: 200, error: false, message: "success", data: ListOrg});
      }

      asyncGetChildOrg(index + 1, ListOrg, res, date);
   }
}

router.get('/list_org', function( req, res) {
   let OrgLevel6 = [], lengLevel6 = 0;
   let OrgLevel7 = [], lengLevel7 = 0;
   let OrgLevel8 = [], lengLevel8 = 0;
   let date = new Date()

   console.log('start method  2',date.getTime());
   Organization.find({ orgLevel : 6 }).select('_id name organizationId').exec()
   .then(function (org) {
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      OrgLevel6 = JSON.parse(JSON.stringify(org));
      // lengLevel6 = emp.length;
      // return Organization.find({ orgLevel : 7 }).select('_id name organizationId orgParentId').exec()

      return Organization.aggregate([
         { $match: { orgLevel: 7 }},
         { $group : { _id : "$orgParentId", children : {$push : { name: "$name", organizationId: "$organizationId" }}}},
         { $project: { "orgParentId": "$_id", children: 1 } }
      ])

   })
   .then(function (org) {
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      OrgLevel7 = JSON.parse(JSON.stringify(org));
      // lengLevel7 = emp.length;
      // return Organization.find({ orgLevel : 8 }).select('_id name organizationId orgParentId').exec()
      return Organization.aggregate([
         { $match: { orgLevel: 8 }},
         {$group : { _id : "$orgParentId", children : {$push : { name: "$name", organizationId: "$organizationId" }}}},
         {$project: { "orgParentId": "$_id", children: 1 } }
      ])
   })
   .then(function (org) {
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      OrgLevel8 = JSON.parse(JSON.stringify(org));
      // lengLevel8= emp.length;
      // console.log(OrgLevel7[1]);
      for (let i = 0; i < OrgLevel7.length; i++) {
         for (let j = 0; j < OrgLevel7[i].children.length; j++) {
            for (let k = 0; k < OrgLevel8.length; k++) {
               if (OrgLevel8[k].orgParentId == OrgLevel7[i]['children'][j].organizationId) {
                  // console.log(`i = ${i}`);
                  OrgLevel7[i]['children'][j]['children'] = OrgLevel8[k]['children'];
               }
            }
         }
      }

      for (let i = 0; i < OrgLevel6.length; i++) {
         for (let k = 0; k < OrgLevel7.length; k++) {
            if (OrgLevel7[k].orgParentId == OrgLevel6[i].organizationId) {
               // console.log(`i = ${i}`);
               OrgLevel6[i]['children'] = OrgLevel7[k];
            }
         }
      }

      res.send({ data: OrgLevel6 })
      let currentDate = new Date();
      console.log('end method  2', currentDate.getTime());
      console.log('method 2: 3 query and 3 for loop, time =  ', currentDate.getTime() - date.getTime());
   })
   .catch( err => {
      console.log(err);
      res.status(500).send({ status: 500 , error: true, message: "Can not connect to server", log: err});
   })
})

router.post('/org_list_child', function(req, res){
   console.log(req.body);
   if (req.body.orgParentId == undefined) {
      return res.status(400).send({ status: 400, error: true, message: "OrgParentId is undefined", data: null });
   }
   Organization.find({ orgParentId : Number(req.body.orgParentId) }, function (err, emp) {
      if(err) return res.status(500).send({ status: 500 , error: true, message: "Can not connect to server", log: err});
      res.status(200).send({ status: 200, error: false, message: "success", data: emp});
   })
})

router.post('/org_list_parent', function(req, res){
   // console.log(req.body);
   let OrgLevel6 = [];
   let OrgLevel7 = [];
   let OrgLevel8 = [];
   let date = new Date();

   // Organization.find({ orgLevel : 6 }).select('_id name organizationId').exec()
   // .then(function (emp) {
   //    if(!emp) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
   //    emp = JSON.parse(JSON.stringify(emp));
   //    let date =  new Date()
   //    asyncGetChildOrg(0, emp, res, date.getTime())
   // }).catch( err => {
   //    console.log(err);
   //    res.status(500).send({ status: 500 , error: true, message: "Can not connect to server", log: err});
   // })

   // console.log('start method  2',date.getTime());
   Organization.find({ orgLevel : 6 }).select('_id name organizationId').exec()
   .then(function (org) {
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      OrgLevel6 = JSON.parse(JSON.stringify(org));
      // lengLevel6 = emp.length;
      // return Organization.find({ orgLevel : 7 }).select('_id name organizationId orgParentId').exec()

      return Organization.aggregate([
         { $match: { orgLevel: 7 }},
         { $group : { _id : "$orgParentId", children : {$push : { name: "$name", organizationId: "$organizationId", _id: "$_id" }}}},
         { $project: { "orgParentId": "$_id", children: 1 } }
      ])

   })
   .then(function (org) {
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      OrgLevel7 = JSON.parse(JSON.stringify(org));
      // lengLevel7 = emp.length;
      // return Organization.find({ orgLevel : 8 }).select('_id name organizationId orgParentId').exec()
      return Organization.aggregate([
         { $match: { orgLevel: 8 }},
         {$group : { _id : "$orgParentId", children : {$push : { name: "$name", organizationId: "$organizationId", _id: "$_id" }}}},
         {$project: { "orgParentId": "$_id", children: 1 } }
      ])
   })
   .then(function (org) {
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      OrgLevel8 = JSON.parse(JSON.stringify(org));
      // lengLevel8= emp.length;
      // console.log(OrgLevel7[1]);
      for (let i = 0; i < OrgLevel7.length; i++) {
         for (let j = 0; j < OrgLevel7[i].children.length; j++) {
            for (let k = 0; k < OrgLevel8.length; k++) {
               if (OrgLevel8[k].orgParentId == OrgLevel7[i]['children'][j].organizationId) {
                  // console.log(`i = ${i}`);
                  // OrgLevel7[i]['children'][j]['children'] = OrgLevel8[k]['children'];
                  OrgLevel7[i]['children'][j]['children'] = OrgLevel8[k]['children'];
               }
            }
         }
      }

      for (let i = 0; i < OrgLevel6.length; i++) {
         for (let k = 0; k < OrgLevel7.length; k++) {
            if (OrgLevel7[k].orgParentId == OrgLevel6[i].organizationId) {
               // console.log(`i = ${i}`);
               OrgLevel6[i]['children'] = OrgLevel7[k]['children'];
            }
         }
      }

      let currentDate = new Date();
      // console.log('end method  2', currentDate.getTime());
      // console.log('method 2: 3 query and 3 for loop, time =  ', currentDate.getTime() - date.getTime());
      return res.status(200).send({ status: 200, error: false, message: "success", data: OrgLevel6});
   })
   .catch( err => {
      console.log(err);
      res.status(500).send({ status: 500 , error: true, message: "Can not connect to server", log: err});
   })
})

router.post('/list_employee', function (req, res) {
   Employee.find().exec(function (err, emp) {
      if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      res.status(200).send({ status: 200, message: "success", error: false, data: emp });
   })
});

router.post('/get_employee_by_id', function (req, res) {
   if(req.body.employeeId == undefined) {
      return res.status(400).send({ status: 400, error: false, message: "EmployeeId is undefined", data: null });
   }
   Employee.findById(req.body.employeeId).exec(function (err, emp) {
      if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      if(emp == null) return res.status(200).send({ status: 200, message: "success", error: true, data: null });
      res.status(200).send({ status: 200, message: "success", error: false, data: emp });
   })
})

router.post('/export_inactive_account', function (req, res) {
   Employee.find({ deactivate: true, secondEmail: {  $elemMatch: { deactivate: false }} }).exec()
   .then(function (emp) {
      if (!emp) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      let exelData = [],
      header = [
         "_id" ,
         "organizationCode",
         "employeeId" ,
         "fullName" ,
         "employeeCode",
         "dateOfBirth" ,
         "gender" ,
         "placeOfBirth" ,
         "permanentAddress" ,
         "currentAddress" ,
         "telephoneNumber" ,
         "mobileNumber" ,
         "trainingLevel" ,
         "partyAdmissionDate" ,
         "partyAdmissionPlace" ,
         "personalIdNumber" ,
         "personalIdIssuedDate" ,
         "personalIdIssuedPlace" ,
         "positionId" ,
         "organizationId" ,
         "deactivate",
         "secondEmail"
      ];
      //add header to exel data
      exelData.push(header);
      // console.log(emp.length);
      // res.send(header);
      for (let i = 0; i < emp.length; i++ ) {
         let rowExel = [];
         let row = emp[i];
         for (let j = 0; j < header.length; j++) {
            let childRow = [];
            // add data to row follow header structure
            childRow.push(row[header[j]]);
            rowExel.push(childRow);
         }

         // add row to exel data
         exelData.push(rowExel);
      }
      // console.log(exelData.length);

      let buffer = xlsx.build([{name: "List User", data: exelData }]); // Returns a buffer
      // res.send({ data: JSON.stringify(exelData) })
      // res.attachment('users.xlsx');
      let date = new Date();
      let name = 'employee-' + date.getTime();
      let filename = `${name}.xlsx`;
      fs.writeFile(`public/xlsx/${filename}`, buffer, function (err) {
         if (err) return res.status(500).send({ status: 500, message: "Can not connect to server", error: true });
         // else res.redirect('http://localhost:3344' + '/xlsx/'+ filename);
         else res.status(200).send({ message: 'success', error: false, link:  `/xlsx/${filename}`})
         // else return res.render('index', { link: `/xlsx/${filename}`, name: filename});
         // else return res.redirect(`/xlsx/${filename}`);
         // else return res.render('index');
      });
      // res.status(200).send({ status: 200, message: "success", error: false, data: emp });
   }).catch( error => {
      // console.log(error);
      return res.status(500).send({ status: 500, message: "Can not connect to server", error: true });
      // return res.send({ err: error });
   })
})

router.post('/employee_search', function (req, res) {
   var { employeeCode, fullName, positionName, mobileNumber, email, secondEmail, fromBirthday, toBirthday,
      organizationId, list_level_one, list_level_two, list_level_three } = req.body;
   console.log(req.body);
   var searchQuery = {};
   var searchQueryAnd = [];

   if(verify.IsNotEmptyOrUndefined(employeeCode)) {
      // searchQuery.employeeCode = new RegExp(employeeCode.trim());
      searchQueryAnd.push({
         employeeCode : new RegExp(employeeCode.trim())
      });
   }

   if(verify.IsNotEmptyOrUndefined(fullName)) {
      // searchQuery.fullName = new RegExp(fullName.trim());
      searchQueryAnd.push({
         fullName : new RegExp(fullName.trim())
      });
   }

   if(verify.IsNotEmptyOrUndefined(positionName)) {
      // searchQuery.positionName = new RegExp(positionName.trim());
      searchQueryAnd.push({
         positionName : new RegExp(positionName.trim())
      });
   }

   if(verify.IsNotEmptyOrUndefined(mobileNumber)) {
      mobileNumber = mobileNumber.replace(/\s+/g, '');
      // searchQuery.mobileNumber = new RegExp(mobileNumber.trim());
      searchQueryAnd.push({
         mobileNumber : new RegExp(mobileNumber.trim())
      });
   }

   if(verify.IsNotEmptyOrUndefined(email)) {
      var searchQueryOr = {};
      searchQueryOr['$or'] = [];

      searchQueryOr['$or'].push({
         email : new RegExp(email.trim())
      });

      searchQueryOr['$or'].push({
         secondEmail : { $elemMatch: { email : new RegExp(email.trim()) } }
      });

      // if(verify.IsNotEmptyOrUndefined(email)){
      //    searchQueryOr['$or'].push({
      //       email : new RegExp(email.trim())
      //    });
      // }
      // if(verify.IsNotEmptyOrUndefined(secondEmail)){
      //    searchQueryOr['$or'].push({
      //       secondEmail : { $elemMatch: { email : new RegExp(secondEmail.trim()) } }
      //    })
      // }
      // console.log(searchQueryOr);

      searchQueryAnd.push(searchQueryOr);
      // searchQuery.email = new RegExp(email.trim());
   }

   if(organizationId != undefined && organizationId > 0) {
      // searchQuery.organizationId = organizationId;
      searchQueryAnd.push({
         organizationId : organizationId
      });
   }

   if(verify.IsNotEmptyOrUndefined(fromBirthday) || verify.IsNotEmptyOrUndefined(toBirthday)){
      var birthdayObject = {};
      if(verify.IsNotEmptyOrUndefined(fromBirthday))
         // searchQuery.dateOfBirth['$gte']  = new Date(fromBirthday).getTime();
         birthdayObject['$gte'] =  new Date(fromBirthday).getTime();
      if(verify.IsNotEmptyOrUndefined(toBirthday))
         // searchQuery.dateOfBirth['$lt']  = new Date(toBirthday).getTime();
         birthdayObject['$lt']  = new Date(toBirthday).getTime();

      searchQueryAnd.push({
         dateOfBirth : birthdayObject
      });
      // console.log(birthdayObject);
   }

   // console.log(searchQueryAnd.length);
   // $and: [
   //    { $or: [ { 'email': /com.vn/}, { secondEmail: { $elemMatch: { email : /gmail/ } } }]},
   //    searchQueryAnd
   // ]

   function filterOrgLevel(list_level_one, list_level_two) {
      for (let i = 0; i < list_level_two.length; i++) {
         for (let j = 0; j < list_level_one.length; j++) {
            if (list_level_two[i].includes(list_level_one[j])) {
               list_level_one.splice(j, 1)
            }
         }
      }

      for (let j = 0; j < list_level_two.length; j++) {
         list_level_two[j] = list_level_two[j].split('|')[1];
      }
   }

   //filter organization by level from 6 to 8
   filterOrgLevel(list_level_one, list_level_two);
   filterOrgLevel(list_level_two, list_level_three);

   Organization.find({ orgParentId: { $in: list_level_one } }).select('organizationId').exec()
   .then( org => {
      //get organizationId where orgLevel = 7
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      org.forEach( function (elem) {
         list_level_two.push(elem.organizationId);
      });
      // console.log('list_level_two', list_level_two);
      return Organization.find({ orgParentId: { $in: list_level_two } }).select('organizationId').exec()

   }).then( org => {

      // get organizationId where orgLevel = 8
      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});
      org.forEach( function (elem) {
         list_level_three.push(elem.organizationId);
      });
      console.log('list_level_three', list_level_three);
      if (list_level_three.length) {
         searchQueryAnd.push({
            organizationId: { $in: list_level_three }
         })
      }

      // start search
      let query = searchQueryAnd.length ? { $and: searchQueryAnd } : {}
      // console.log(query);
      // console.log(list_level_three);
      return Employee.find(query).exec()

   }).then( org => {

      if(!org) return res.status(200).send({ status: 200 , error: true, message: "organization is null"});

      res.status(200).send({ status: 200, message: "success", error: false, data: org });

   }).catch( err => {
      return res.status(500).send({ status: 500, message: "Can not connect to server", error: true, log: err });
   })


   // console.log('list_level_one', list_level_one);
   // console.log('list_level_two', list_level_two);
   // console.log('list_level_three', list_level_three);

   // Employee.find(query)
   // .exec(function (err, emp) {
   //    if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
   //    res.status(200).send({ status: 200, message: "success", error: false, data: emp });
   // });
})

router.post('/add_second_email', function (req, res) {
   if(req.body.secondEmail == undefined) {
      return res.status(400).send({ status: 400, error: true, message: "Second email is undefined", data: null });
   }

   if(req.body.employeeId == undefined) {
      return res.status(400).send({ status: 400, error: false, message: "EmployeeId is undefined", data: null });
   }

   Employee.findByIdAndUpdate(req.body.employeeId, {$push: { secondEmail : { email: req.body.secondEmail, deactivate: false }}}, {multi:true})
   .exec(function( err, callback){
      if (err) return res.status(500).send({ status: 500, message: "Can not connect to server", error: true });
      if (callback == null)
         return res.status(200).send({ status: 200, message: "Employee not exist", error: true });
      else
         res.status(200).send({ status: 200, message: "Add email success", error: false });
   })
})

router.post('/deactivate_account', function (req, res) {
   // console.log(!req.body.status);
   if(req.body.employeeId == undefined) {
      return res.status(400).send({ status: 400, error: false, message: "EmployeeId is undefined", data: null });
   }

   if(req.body.status == undefined) {
      return res.status(400).send({ status: 400, error: false, message: "Status is undefined", data: null });
   }

   Employee.findByIdAndUpdate(req.body.employeeId,
      { $set: { deactivate : !req.body.status }},
      { new: true}
   ).exec(function( err, callback){
      if (err) return res.status(500).send({ status: 500, message: "Can not connect to server", error: true });
      // console.log(callback);
      if (callback == null)
         return res.status(200).send({ status: 200, message: "Account not exist", error: true });
      else
         res.status(200).send({ status: 200, message: " Update status success", error: false, data: callback });
   })
})

router.post('/deactivate_email', function (req, res) {
   console.log(req.body);
   if(req.body.secondEmailId == undefined) {
      return res.status(400).send({ status: 400, error: true, message: "Second email id is undefined", data: null });
   }

   if(req.body.employeeId == undefined) {
      return res.status(400).send({ status: 400, error: false, message: "EmployeeId is undefined", data: null });
   }
   // ({_id: yourTestId, categories: {$elemMatch: {_id: categoryId}}}, {$set: {$inc: {"categories.$.points":  10, points: 10}}})
   Employee.findOneAndUpdate({ _id: req.body.employeeId, secondEmail: { $elemMatch: {_id: req.body.secondEmailId} }} ,
      { $set: { "secondEmail.$.deactivate" : true }},
      { multi:true}
   )
   .exec(function( err, callback){
      if (err) return res.status(500).send({ status: 500, message: "Can not connect to server", error: true, log: err });
      if (callback == null)
         return res.status(200).send({ status: 200, message: "Email not exist", error: true });
      else
         res.status(200).send({ status: 200, message: "Update email status success", error: false });
   })
})
// ****************************** END OF EMPLOYEE ******************************


module.exports = router;
