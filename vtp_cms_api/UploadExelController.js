var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var axios = require('axios');
var multer = require('multer');
var path = require('path');
var xlsx = require('node-xlsx');
var jwt = require('jsonwebtoken');
var schedule = require('node-schedule');

var verify = require('../auth/VerifyToken');
// var shortenUrl = require('../auth/ShortenUrl');
var UploadExel = require('../dao/upload-exel');
var DailyReportExcel = require('../dao/daily-report-excel');
var FileManagement = require('../dao/file-management');
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

// const NLP_URL  = "http://address-address.oc.viettelpost.vn/parser";
// const NLP_URL  = "http://35.240.247.10/parser";
const NLP_URL  = "http://address-address.oc.viettelpost.vn/parser";
const GetOrderPriceUrl = "https://api.viettelpost.vn/api/tmdt/getPrice";
const GetOrderDetailUrl = "https://api.viettelpost.vn/api/setting/getOrderDetail?OrderNumber=";
const InsertOrderUrl = "https://api.viettelpost.vn/api/tmdt/InsertOrder";
const NotifyUrl = "https://io.viettelpost.vn/notification/v1.0/notification";
// const MAX_FILE_SIZE = 1048576;
const MAX_FILE_SIZE = 1048576;

// var domain = "http://localhost:3344";
var domain = "http://125.212.238.119:3344";



function delay() {
   return new Promise( resolve => setTimeout(resolve, 300))
}

function formatDateTime(date) {
   // let date = new Date();
   let month = date.getMonth() + 1,
      day = date.getDate(),
      hour = date.getHours(),
      minute = date.getMinutes(),
      second = date.getSeconds();
   let dateFormat = ( day < 10 ? '0' + day : day ) + '/'
                     + ( month < 10 ? '0' + month : month ) + '/'
                     + date.getFullYear() + ' '
                     + ( hour < 10 ? '0' + hour : hour )+ ':'
                     + ( minute < 10 ? '0' + minute : minute ) + ':'
                     + ( second < 10 ? '0' + second : second );

   return dateFormat;
}

function formatDateTimeNotify(date) {
   // let date = new Date();
   let month = date.getMonth() + 1,
      day = date.getDate(),
      hour = date.getHours(),
      minute = date.getMinutes(),
      second = date.getSeconds();
   let dateFormat = ( hour < 10 ? '0' + hour : hour )+ ':'
                     + ( minute < 10 ? '0' + minute : minute ) + ':'
                     + ( second < 10 ? '0' + second : second ) + ' '
                     + ( day < 10 ? '0' + day : day ) + '/'
                     + ( month < 10 ? '0' + month : month ) + '/'
                     + date.getFullYear();

   return dateFormat;
}

function convertToNumber(str) {
   return str ? Number(str) : 0;
}

const baseExcelFolderPath = '../VTPCMS/public/xlsx/';
let nextDay = new Date();
let folderPathOfNextDay = baseExcelFolderPath + nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear();
let baseExcelFolderPathByDay = folderPathOfNextDay+ '/';

// UPLOAD FILE EXEL
var exelStorage = multer.diskStorage({
   destination: function (req, file, cb) {
       let nextDay = new Date();
       let folderPathOfNextDay = baseExcelFolderPath + nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear();
      // console.log(folderPathOfNextDay);
      cb(null, folderPathOfNextDay);
   },
   filename: function (req, file, cb) {
       let file_name = Date.now() + '.' + file.originalname.split('.').slice(-1)[0];
       if (req.headers.token) {
           var decoded = jwt.decode(req.headers.token)
           file_name = decoded.UserId + '-' + file_name
       }
      cb(null, file_name)
   }
});

const exelUpoad = multer({ storage: exelStorage });
var rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 0;
rule.second = 0;
//SCHEDULE FOR DAILY REPORT
var j = schedule.scheduleJob(rule, async function(){
    console.log('****************************BEGIN A NEW DAY****************************');
    let nextDay = new Date();
    let folderPathOfNextDay = baseExcelFolderPath + nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear();
    fs.mkdir(folderPathOfNextDay, function(err, success){
        if (err) {
            console.log(err);
            console.log('mkdir error');
            return;
        }

        baseExcelFolderPathByDay = folderPathOfNextDay + '/';
        console.log('mkdir success');
    })
    let listTester = [ "1702545", "1486445", "1464987", "1709259", "1710799","1710795", "1712017", "1364830" ];
    let listFile = await new Promise(function(resolve, reject) {
        UploadExel.find({ uploadTime : { $gt: nextDay.getTime() - 86400000, $lt: nextDay.getTime() }, cusId: { $nin: listTester }}, { _id: 1, cusId: 1 }, function(err, dailyReports){
            if (err) {
                return reject('error')
            }
            return resolve(dailyReports);

        })
    });

    if (typeof listFile == "string") {
        console.log('error when get list file in a day');
        return;
    }

    let listUserId = [];

    let listId = listFile.map( function(item){
        if (!listUserId.includes(item.cusId)) {
            listUserId.push(item.cusId);
        }
        return item._id;
    });

    console.log(listId);

    let listCountOrder = await new Promise(function(resolve, reject) {
        UploadExel.aggregate([
            { $match: { _id : { $in: listId } } },
            { $unwind: "$content" },
            {$group : { _id : "$content.status" , count: { $sum: 1 } }},
            { $project: { "status": "$_id", count : 1 } }
        ], function(err, response){
            if (err) return reject('error')
            return resolve(response);
        })
    });

    if (typeof listCountOrder == 'string') {
        console.log('error when count number order in a day');
        return;
    }


    let total_create_success = 0, total_create_error = 0, total_error = 0, total_validate_error = 0, total_validate_success = 0, total_nlp_error = 0;
    for (let i = 0; i < listCountOrder.length; i++) {
        switch (listCountOrder[i].status) {
            case "Completed":
                total_create_success += listCountOrder[i].count;
                break;
            case "Error":
                total_error += listCountOrder[i].count;
                break;
            case "NLPError":
                total_nlp_error += listCountOrder[i].count;
                break;
            case "ValidateError":
                total_validate_error += listCountOrder[i].count;
                break;
            case "ValidateSuccess":
                total_validate_success += listCountOrder[i].count;
                break;
            case "CreateOrderError":
                total_create_error += listCountOrder[i].count;
                break;
            default:
        }
    }

    console.log(listCountOrder);
    let dateReport = new Date(nextDay.getTime() - 86400000 + 1);
    let insertObj = {
        date_time: dateReport,
        number_user: listUserId.length,
        number_file: listFile.length,
        list_success: {
            create_success: total_create_success,
            validate_success: total_validate_success
        },
        list_error: {
            error: total_error,
            NLP_error: total_nlp_error,
            validate_error: total_validate_error,
            create_error: total_create_error
        }
    }
    DailyReportExcel.create(insertObj, function (err, response) {
        if (err) {
            console.log('insert daily report to database error');
            return;
        }
        console.log('insert daily report to database success');
    })

});


//  SCHEDULE CHECK ORDER
var j = schedule.scheduleJob('*/10 * * * * *', function(){
   // console.log('Start check order');
   checkOrderCronJob();
});

// let list = [];
// for (let i = 0; i < 100; i++) {
//    list.push(i);
// }
// let response = [];
// let date = new Date();
// console.log('start of promise all' + date.getTime());
//
// // functionName();
//
// async function functionName() {
//    let x = await test();
//    let currentDate = new Date();
//    console.log('time ========' + ( currentDate.getTime() - date.getTime() ));
//    console.log(x);
// }
//
// // let x =  test();
// // console.log(x);
// // test();
// async function test() {
//    let promises  = list.map( function(item) {
//       // console.log('---' + item);
//       return new Promise( (resolve, reject) => {
//          axios.post(NLP_URL, { addresss: [""] })
//          .then( resp => {
//             // console.log(item);
//             response.push(item + ' - response');
//             return resolve(item + ' - response');
//          })
//          .catch(
//             err => {
//                resolve(item + ' - error')
//             }
//          )
//       })
//    })
//    // let resOfAll = await Promise.all(promises);
//    return Promise.all(promises);
//    // return resOfAll;
//    // console.log(resOfAll);
//    // Promise.all(promises).then(
//    //    res => {
//    //       let currentDate = new Date();
//    //       console.log('end time of promise all= ' + currentDate.getTime());
//    //       console.log('estimate time = ' + (currentDate.getTime() - date.getTime()));
//    //       console.log(res);
//    //       res.map( function(elem) {
//    //          // console.log('elem ' + elem);
//    //       })
//    //       // console.log(item);
//    //    }
//    // )
// }
//
//
// date = new Date();
// console.log('start of sequece' + date.getTime());
// getAll(list);
//
//
// async function getAll(list) {
//    for (let i = 0; i < list.length; i++) {
//       await getResponse(list[i]);
//    }
//    let currentDate = new Date();
//    console.log('end time of sequence = ' + currentDate.getTime());
//    console.log('time = ' + (currentDate.getTime() - date.getTime()));
// }
//
// function getResponse(item) {
//    return new Promise( (resolve, reject) => {
//       axios.post(NLP_URL, { addresss: [""] })
//       .then( resp => {
//          // console.log('async' + item);
//          response.push(item + ' - async response');
//          resolve(item + ' - async response');
//       })
//       .catch(
//          err => {
//             resolve(item + ' - async error')
//          }
//       )
//    })
// }



// TEST CHECK ORDER
// router.post('/test-check-order', function (req, res) {
function checkOrderCronJob() {
   let responseObject = [];
   // console.log(req.headers.token);
   let token = "";
   let ListFileChanged = [];
   // axios.post("https://api.viettelpost.vn/api/user/Login", {
   //    "USERNAME": "nguyenthic@gmail.com",
   //    "PASSWORD" : "123456",
   //    "SOURCE" : 0
   // })
   // .then( loginResponse => {
   //    token = loginResponse.data.TokenKey;
   //    return UploadExel.find({ status: { $in: ["Change",  "Uploaded"] }}).exec()
   // })
   UploadExel.find({ status: { $in: ["Change",  "Uploaded"] }}).exec()
   .then( listFile => {
      if (listFile) {
         ListFileChanged = listFile;
         return UploadExel.updateMany({ status: { $in: ["Change",  "Uploaded"] }}, { $set: { status: "Processing" } } ).exec()
         // return UploadExel.find({ status: { $in: ["Change",  "Uploaded"] }} ).exec()
      }
      //if no file changed
      return res.status(200).send({ status: 200, error: true, message: "no file changed", data: null });
   })
   .then( updateResult => {
      // console.log(updateResult);
      if (updateResult) {
         return UploadExel.find({ status: "Processing" }).exec();
      }

      //if update file status fail
      return res.status(200).send({ status: 200, error: true, message: "update file status fail", data: null });
   })
   .then( processingFile => {
      if (processingFile) {
         console.log("Number of excel file have status New/Change : ", ListFileChanged.length);
         // checkOrderToInsert(processingFile);
         // checkOrderToInsertTest(processingFile);
         checkOrderToInsertTest(ListFileChanged);
         // return res.status(200).send({ status: 200, error: true, message: "success", data: processingFile });
      }

      //if has no processing file
      // return res.status(200).send({ status: 200, error: true, message: "no processing file", data: null });
   })
   .catch( err => {
      console.log('Error on checkOrderCronJob function');
      console.log(err);
      // return res.status(500).send({ status: 500, error: true, message: "error", data: null, log: err });
   })

}
// })

function updateCheckInfoStatusMongo(list_check_info, id) {
   // console.log('line 219', list_check_info);
   const listPromise = list_check_info.map( function(order) {
      return new Promise( (resolve, reject) => {
            // console.log(order.index);
            UploadExel.findOneAndUpdate(
               { "_id": id, "content.index": order.index },
               {
                   "$set": { "content.$.status": "Error" },
                   "$push": { "content.$.message":  { $each : order.message } }
                }
            ).exec()
            .then( (checkInfoRes) => {
               // console.log("checkInfoRes ", checkInfoRes);
               // console.log('line 234', checkInfoRes);
               if ( checkInfoRes) {
                  // update NLP success
                  // console.log(res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               console.log(err);
               console.log('error in updateCheckInfoStatusMongo');
               reject('error')
            });

      })
               // }
   });

   return Promise.all(listPromise);
}

function updateSetInvalidMessageStatusMongo(list_check_info, id) {
   // console.log('line 219', list_check_info);
   const listPromise = list_check_info.map( function(order) {
      let optionsInsert = {};
      // console.log(order.message.length);
      // console.log(order.message[0]);
      return new Promise( (resolve, reject) => {

            UploadExel.findOneAndUpdate(
               { "_id": id, "content.index" : order.index  },
               { $addToSet: { "content.$.message":  { $each : order.message } } }
            ).exec()
            .then( (checkInfoRes) => {
               // console.log("checkInfoRes ", checkInfoRes);
               // console.log('line 234', checkInfoRes);
               if ( checkInfoRes) {
                  // update NLP success
                  // console.log(res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               // console.log(err);
               console.log('error in updateCheckInfoStatusMongo');
               reject('error')
            });

      })
               // }
   });

   return Promise.all(listPromise);
}

function updateNLPStatusMongo(list_order, id) {
   const listPromise = list_order.map( function(order) {
      // console.log(id);
      // console.log(order.NLP.province.code);
      return new Promise( (resolve, reject) => {
         UploadExel.findOneAndUpdate(
            { "_id": id, "content.index" : order.index  },
            { $set: {
               "content.$.NLP.RECEIVER_PROVINCE" : order.NLP.RECEIVER_PROVINCE,
               "content.$.NLP.RECEIVER_DISTRICT" : order.NLP.RECEIVER_DISTRICT,
               "content.$.NLP.RECEIVER_WARD" : order.NLP.RECEIVER_WARD
            }}
         ).exec()
         .then( (res) => {
            if ( res) {
               // update NLP success
               // console.log(res);
               resolve('success');
            } else {
               // update NLP error
               reject('error')
               // reject(res);
            }
         })
         .catch( err => {
            // console.log(err);
            console.log('error in updateNLPStatusMongo');
            reject('error')
         });
      })
   });

   return Promise.all(listPromise);
}

function updateStatusNLPError(listIndexNLPError, fileId) {
   // console.log(fileId);
   // console.log(listIndexNLPError);
   // let NLPErrorPromise = new Promise( resolve => {} ), validateErrorPromise = new Promise(resolve => {}), insertErrorPromise = new Promise(resolve => {});
   if (listIndexNLPError.length) {
      let NLPErrorPromise =  listIndexNLPError.map( function(i) {
         return new Promise( (resolve, reject) => {
            UploadExel.findOneAndUpdate(
               {
                 _id: fileId,
                 "content.index": i
               },
               { $set:
                  {
                     "content.$.status" : "NLPError",
                     "content.$.message" : ["Địa chỉ người nhận không hợp lệ"],
                  }
               },
               // { arrayFilters: [  { "ele.index": 6 } ], multi: true}
               // { arrayFilters: [  { "score": { $gte: 8 } } ], multi: true}
            ).exec()
            .then( (res) => {
               if ( res) {
                  // console.log('update order where NLP error', res);
                  // update NLP success
                  // console.log(res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               console.log(err);
               console.log('error in updateNLPStatusMongo');
               reject('error')
            });
         });
      });

      return Promise.all(NLPErrorPromise);
   }

   else {
      return new Promise( resolve => {
         resolve('success');
      })
   }
}

function updateStatusValidateError(listIndexValidateError, fileId) {
   if (listIndexValidateError.length) {
      let validateErrorPromise = listIndexValidateError.map( function(i) {
         new Promise( (resolve, reject) => {
            UploadExel.findOneAndUpdate(
               { "_id": fileId, "content.index" : i },
               { $set: {
                  "content.$.status" : "ValidateError",
                  "content.$.message" : ["Bảng giá không áp dụng cho hành trình này"]
               }}
            ).exec()
            .then( (res) => {
               if ( res) {
                  // update NLP success
                  // console.log('update order where validate error', res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               // console.log(err);
               console.log('error in updateValidateStatusMongo');
               reject('error')
            });
         });
      })

      return Promise.all(validateErrorPromise);
   }
   else {
      return new Promise( resolve => {
         resolve('success');
      })
   }
}

function updateStatusValidateSuccess(listValidateSuccess, fileId) {
   if (listValidateSuccess.length) {
      let validateSuccessPromise = listValidateSuccess.map( function(item) {
         // console.log(item.price);
         let lenOfListFee = item.price.length;
         let fee_other = 0;
         for (let i = 2; i < lenOfListFee - 2; i++) {
            fee_other +=  Number(item.price[i].PRICE);
         }
         new Promise( (resolve, reject) => {
            UploadExel.findOneAndUpdate(
               { "_id": fileId, "content.index" : item.index },
               { $set: {
                  "content.$.status" : "ValidateSuccess",
                  "content.$.FEE.MONEY_TOTAL": Number(item.price[0].PRICE),
                  "content.$.FEE.MONEY_TOTALVAT": Number(item.price[1].PRICE),
                  "content.$.FEE.MONEY_TOTALFEE": Number(item.price[lenOfListFee - 1].PRICE),
                  "content.$.FEE.MONEY_FEE": Number(item.price[lenOfListFee - 2].PRICE),
                  "content.$.FEE.MONEY_FEECOD": fee_other,
               }}
            ).exec()
            .then( (res) => {
               if ( res) {
                  // update NLP success
                  // console.log('update order where validate error', res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               // console.log(err);
               console.log('error in updateValidatetatusMongo');
               reject('error')
            });
         });
      })

      return Promise.all(validateSuccessPromise);
   }
   else {
      return new Promise( resolve => {
         resolve('success');
      })
   }
}

function updateStatusInsertError(listIndexInsertError, fileId) {
   if (listIndexInsertError.length) {
      let insertErrorPromise =  listIndexInsertError.map( function(i) {
         new Promise( (resolve, reject) => {

            UploadExel.findOneAndUpdate(
               { "_id": fileId, "content.index" : i },
               { $set: {
                  "content.$.status" : "CreateOrderError",
                  "content.$.message" : ["Bảng giá không áp dụng cho hành trình này"]
               }}
            ).exec()
            .then( (res) => {
               if ( res) {
                  // update NLP success
                  // console.log('update order where insert error', res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               // console.log(err);
               console.log('error in updateNLPStatusMongo');
               reject('error')
            });
         });
      });

      return Promise.all(insertErrorPromise);
   }
   else {
      return new Promise( resolve => {
         resolve('success');
      })
   }
};

function updateStatusInsertSuccess(listInsertSuccess, fileId) {
   if (listInsertSuccess.length) {
      let insertSuccessPromise =  listInsertSuccess.map( function(item) {
         new Promise( (resolve, reject) => {

            UploadExel.findOneAndUpdate(
               { "_id": fileId, "content.index" : item.index },
               { $set: {
                  "content.$.status" : "Completed",
                  "content.$.order.MA_DON_HANG" : item.order.MA_DON_HANG,
               }}
            ).exec()
            .then( (res) => {
               if ( res) {
                  // update NLP success
                  // console.log('update order where insert success', res);
                  resolve('success');
               } else {
                  // update NLP error
                  reject('error')
                  // reject(res);
               }
            })
            .catch( err => {
               // console.log(err);
               console.log('error in updateNLPStatusMongo');
               reject('error')
            });
         });
      });

      return Promise.all(insertSuccessPromise);
   }
   else {
      return new Promise( resolve => {
         resolve('success');
      })
   }
}
   // return Promise.all(NLPErrorPromise.concat(validateErrorPromise).concat(insertErrorPromise));

// INSERT TEST
async function checkOrderToInsertTest(array) {
   console.log('test checkOrderToInsertTest');
   // check each file one by one
   try {
      for (let item in array) {
         console.log('<----------------------------------------------------------------------->');
         console.log(item + '. ' + array[item]._id);
         await checkListAllOrder(array[item], array[item].token);
         console.log('<----------------------------------------------------------------------->');
      }
   } catch (e) {
      console.log('Error on checkOrderToInsert function');
   } finally {
      console.log('Done check all file !!!!!!!!!!!');
   }

}

async function checkListAllOrder(list, token) {
   console.log('checkListOrderTest');
   let list_order_id = list._id,
      fileName = list.originalName,
      uploadTime = list.uploadTime,
      list_status = verify.list_status;
      list_status_required = verify.list_status_require;
   try {
      let inventory = list.inventory,
          list_order = list.content;

      // let listInfoValid = [];
      // let listCheckInfoResponse = [];
      // for (let i = 0; i < list_order.length; i++) {
      //    let order_item = list_order[i].order;
      //    let message = [];
      //    for (let key in order_item) {
      //       if (list_status_required.includes(key) && !order_item[key]) {
      //          message.push(verify.formatMessageError(list_status[key]))
      //       }
      //       if (key == "DIEN_THOAI_KHNHAN" && !verify.IsPhoneNumber(order_item[key]) ) {
      //          message.push("Số điện thoại người nhận không hợp lệ");
      //       }
      //    }
      //    // console.log("message.length" , message.length);
      //    if (message.length == 0) {
      //       // console.log('push to list info valid');
      //       listInfoValid.push(list_order[i]);
      //    }
      //
      //    listCheckInfoResponse.push({
      //       index: list_order[i].index,
      //       message: message
      //    })
      // }

      // console.log(listInfoValid);

      // let updateStatusCheckInfoResponse = await updateCheckInfoStatusMongo(listCheckInfoResponse, list._id);
      // // console.log(updateStatusCheckInfoResponse);
      // if (updateStatusCheckInfoResponse.includes('error')) {
      //    // call noti API
      //    return Promise.reject('exit');
      // }

      // console.log(listCheckInfoResponse);

      //add address to check NLP
      // let listReceiverAddress = [];
      // // const listPromise = list_order.map( function(item) {
      // const listPromise = listInfoValid.map( function(item) {
      //    listReceiverAddress.push(item.order.DIACHI_KHNHAN);
      // });

      let listReceiverAddress = [];
      // const listPromise = list_order.map( function(item) {
      const listPromise = list_order.map( function(item) {
         listReceiverAddress.push(item.order.DIACHI_KHNHAN);
      });

      // START CHECK NLP
      let NLPResponse = await checkNLPMultipleOrder(listReceiverAddress);
      if(NLPResponse.includes('error')) {
          console.log("Get NLP API error");
         return Promise.reject('exit');
      }
      // console.log('587', NLPResponse);
      // console.log(NLPResponse[0].province.code);
      let listIndexNLPError = [], listNLPSuccess = [];
      for (let i = 0; i < NLPResponse.length; i++) {
         // console.log(NLPResponse[i].province.code);
         list_order[i].NLP.RECEIVER_PROVINCE = NLPResponse[i].province.code;
         list_order[i].NLP.RECEIVER_DISTRICT = NLPResponse[i].district.code;
         list_order[i].NLP.RECEIVER_WARD = NLPResponse[i].commune.code;

         if (NLPResponse[i].province.code == 0 && NLPResponse[i].district.code == 0 && NLPResponse[i].commune.code == 0) {
            // insert index to listIndexNLPError
            listIndexNLPError.push(list_order[i].index)
         } else {
            //insert to listNLPSuccess
            listNLPSuccess.push(list_order[i]);
         }
      }

      let updateNLPMongoRes = await updateNLPStatusMongo(list_order, list._id);
      if (updateNLPMongoRes.includes('error')) {
         // call noti API
         console.log("update NLP status on mongodb error");
         return Promise.reject('exit');
      }
      console.log('List index NLPError', listIndexNLPError);
      // console.log(listNLPSuccess);
      // END OF CHECK NLP

      // check info valid or missing  of (validate error + validate success)

        let listInfoValid = [], listIndexInfoInvalid = [];
        let listCheckInfoResponse = [];
      for (let i = 0; i < listNLPSuccess.length; i++) {
         let order_item = listNLPSuccess[i].order;

         let message = [];
         for (let key in order_item) {
            if (list_status_required.includes(key) && !order_item[key]) {
               message.push(verify.formatMessageError(list_status[key]))
            }
            else if (key == "DIEN_THOAI_KHNHAN" && !verify.IsPhoneNumber(order_item[key]) ) {
               message.push("Số điện thoại người nhận không hợp lệ");
            }
         }
         // console.log(message);
         // console.log("message.length" , message.length);
         if (message.length) {

             // if (listIndexValidateSuccess.includes(listNLPSuccess[i].index)){
             //     let indexOf = listIndexValidateSuccess.indexOf(listNLPSuccess[i].index);
             //    listIndexValidateSuccess.splice(indexOf, 1);
             // }
             // if (listIndexValidateError.includes(listNLPSuccess[i].index)){
             //     let indexOf = listIndexValidateError.indexOf(listNLPSuccess[i].index);
             //    listIndexValidateError.splice(indexOf, 1);
             // }

            listIndexInfoInvalid.push(listNLPSuccess[i].index);
            listCheckInfoResponse.push({
               index: listNLPSuccess[i].index,
               message: message
            })
         }



      }

      // START CHECK PRICE
      let listIndexValidateError = [], listIndexValidateSuccess = [], listValidateSuccess = [];
      let  responseGetPrice =  await getPriceMultipleOrder(listNLPSuccess, inventory);

      for (let i = 0; i < responseGetPrice.length; i++) {
         if (responseGetPrice[i].error) {
            // if order is not validated
            if (!listIndexInfoInvalid.includes(listNLPSuccess[i].index)) {
                listIndexValidateError.push(listNLPSuccess[i].index);
            }

         } else {
            // if order validate
            if (!listIndexInfoInvalid.includes(listNLPSuccess[i].index)) {
                listIndexValidateSuccess.push(listNLPSuccess[i].index);
                listValidateSuccess.push({
                   ...listNLPSuccess[i],
                   "price": responseGetPrice[i]
                });
            }

         }
      }



      // if validate sucess -> check info valid or missing
      // for (let i = 0; i < listValidateSuccess.length; i++) {
      //    let order_item = listValidateSuccess[i].order;
      //    let message = [];
      //    for (let key in order_item) {
      //       if (list_status_required.includes(key) && !order_item[key]) {
      //          message.push(verify.formatMessageError(list_status[key]))
      //       }
      //       else if (key == "DIEN_THOAI_KHNHAN" && !verify.IsPhoneNumber(order_item[key]) ) {
      //          message.push("Số điện thoại người nhận không hợp lệ");
      //       }
      //    }
      //    // console.log("message.length" , message.length);
      //
      //    if (message.length == 0) {
      //       // console.log('push to list info valid');
      //       listInfoValid.push(listValidateSuccess[i]);
      //    }
      //
      //    else {
      //       listIndexInfoInvalid.push(listValidateSuccess[i].index);
      //       listCheckInfoResponse.push({
      //          index: listValidateSuccess[i].index,
      //          message: message
      //       })
      //    }
      //
      // }

      // console.log(listInfoValid);

      // console.log(listValidateSuccess);
      //END OF CHECK PRICE

      // START INSERT ORDER
      // let listIndexInsertError = [], listInsertSuccess = [];
      // let responseInsertOrder = await insertMultipleOrder(listValidateSuccess, inventory, token);
      // // console.log(responseInsertOrder);
      //
      // for (let i = 0; i < responseInsertOrder.length; i++) {
      //    if (responseInsertOrder[i].status == 200 && !responseInsertOrder[i].error) {
      //       //if insert order success
      //       listValidateSuccess[i].order.MA_DON_HANG = responseInsertOrder[i].data.ORDER_NUMBER;
      //       listInsertSuccess.push(listValidateSuccess[i])
      //    } else {
      //       // if insert order error
      //       listIndexInsertError.push(listValidateSuccess[i].index);
      //    }
      // }

      // console.log('List index InsertError', listIndexInsertError);
      // console.log(listInsertSuccess);
      // END OF INSERT ORDER


      //update status for NLP error on mongodb
      let updateStatusNLPErrorRes = await updateStatusNLPError(listIndexNLPError, list._id);
      if (updateStatusNLPErrorRes.includes('error')) {
         // call noti API
         console.log('Update status NLP error on mongodb error');
         return Promise.reject('exit');
      }

      // update status for validate error on mongodb
      let updateStatusValidateErrorRes = await updateStatusValidateError(listIndexValidateError, list._id);
      if (updateStatusValidateErrorRes.includes('error')) {
         // call noti API
         console.log('Update status validate error on mongodb error');
         return Promise.reject('exit');
      }

      // update status for validate success on mongodb
      // let updateStatusValidateSuccessRes = await updateStatusValidateSuccess(listIndexValidateSuccess, list._id);
      let updateStatusValidateSuccessRes = await updateStatusValidateSuccess(listValidateSuccess, list._id);
      if (updateStatusValidateSuccessRes.includes('error')) {
         // call noti API
         console.log('Update status validate success on mongodb error');
         return Promise.reject('exit');
      }

      console.log("listIndexInfoInvalid ", listIndexInfoInvalid);

      console.log('List index ValidateError', listIndexValidateError);

      console.log('List index ValidateSuccess', listIndexValidateSuccess);
      // console.log("listCheckInfoResponse ", listCheckInfoResponse);
      let updateStatusCheckInfoResponse = await updateCheckInfoStatusMongo(listCheckInfoResponse, list._id);

      console.log("updateStatusCheckInfoResponse ", updateStatusCheckInfoResponse);
      if (updateStatusCheckInfoResponse.includes('error')) {
         // call noti API
         console.log('Update status ERROR on mongodb error');
         return Promise.reject('exit');
      }

      // let updateInvalidMessageRes = await updateSetInvalidMessageStatusMongo(listCheckInfoResponse, list._id);
      //
      // // console.log("updateInvalidMessageRes ", updateInvalidMessageRes);
      // if (updateInvalidMessageRes.includes('error')) {
      //    // call noti API
      //    console.log('Update status of order missing info on mongodb error');
      //    return Promise.reject('exit');
      // }

      console.log('Total error(missing info or info invalid) = ', listIndexInfoInvalid.length);

      // update status for insert order error on mongodb
      // let updateStatusInsertErrorRes = await updateStatusInsertError(listIndexInsertError, list._id);
      // if (updateStatusInsertErrorRes.includes('error')) {
      //    // call noti API
      //    return Promise.reject('exit');
      // }
      //
      // // update status for insert order success on mongodb
      // let updateStatusInsertSuccessRes= await updateStatusInsertSuccess(listInsertSuccess, list._id);
      // if (updateStatusInsertSuccessRes.includes('error')) {
      //    // call noti API
      //    return Promise.reject('exit');
      // }

      // update status compl for file exel when check all order complete
      let updateStatusComplete = await new Promise( (resolve, reject) => {
         UploadExel.findOneAndUpdate({ _id: list._id }, { $set: { status: "Completed" } }).exec()
         .then( success => {
            resolve('success')
         })
         .catch( err =>{
            reject('error')
         })
      });

      if ( updateStatusComplete == "error") {
         return Promise.reject('exit');
      }

      // start send notify

      let notifyHeader = {
         headers: {
            "Authorization" :  "Bearer SYSTEM-619d5252bd915410515d5fdf981b5964",
            "Content-Type" : "application/json"
         }
      };

      let date = new Date();

      let notifyObject = {
         "id":"#",
         "app":"vtp",
         "badge":1,
         "title":"Thông báo",
         "content":"Hoàn thành kiểm tra tất cả các đơn hàng trong file " + fileName + " tải lên lúc " + formatDateTimeNotify(new Date(uploadTime)),
         "icon":"https://viettelpost.vn/img/thongbao/i_donhangthanhcong.png",
         "time": date.getTime(),
         "owner": inventory.CUS_ID.toString(),
         "status":0,
         "type":5,
         "ref": "excel-" + list._id
      };

      axios.post(NotifyUrl, notifyObject, notifyHeader)
      .then( success => {
         // console.log(success);
         if (success) {
            console.log('notify success');
            return Promise.resolve('notify success');
         }
         sendNotify(notifyObject, notifyHeader);

      })
      .catch( err => {
         console.log('notify error');
         sendNotify(notifyObject, notifyHeader);
         // return Promise.reject('notify error');
      });

      console.log('Done promise all !!!!!');

   } catch (e) {
      console.log(e);
      console.log('Can not connect to server or API error');
   } finally {
      console.log(`End check list order ${list_order_id}`);
   }

}

function sendNotify(notifyObject, notifyHeader) {
   axios.post(NotifyUrl, notifyObject, notifyHeader)
   .then( success => {
      if (success) {
         console.log('notify again success');
         return Promise.resolve('notify success');
      }
      console.log('notify again error');
      // sendNotify(notifyObject, notifyHeader);
   })
   .catch( err => {
      console.log('notify again error');
      return Promise.reject('notify error');
      // sendNotify(notifyObject, notifyHeader);
   })
}

function checkNLPMultipleOrder(listReceiverAddress) {
   return new Promise ((resolve, reject) => {
      // console.log(item);
      axios.post(NLP_URL, { addresss: listReceiverAddress })
      .then( response => {
         // console.log(response.data);
         // console.log('axios post success');
         if (response && response.data) {
            return resolve(response.data);
         }
         resolve('error');
      })
      .catch( err => {
         // console.log(err);
         resolve('error');
      })
   })
}

async function getPriceMultipleOrder(list_item, inventory) {
   // console.log(list_item);
   const listGetPricePromise = list_item.map( function(item) {
      return new Promise ((resolve, reject) => {
         // console.log(item.order);
         let order_info = {
            "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
            "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
            "RECEIVER_PROVINCE": item.NLP.RECEIVER_PROVINCE,
            "RECEIVER_DISTRICT": item.NLP.RECEIVER_DISTRICT,
            "PRODUCT_TYPE": "HH",
            "ORDER_SERVICE": item.order.DICH_VU.split('-')[0].trim(),
            "ORDER_SERVICE_ADD": item.order.DICH_VU_KHAC,
            "PRODUCT_WEIGHT": item.order.TRONG_LUONG_GRAM,
            "PRODUCT_PRICE": item.order.TRI_GIA_HANG,
            "MONEY_COLLECTION": item.order.TIEN_THU_HO,
            "PRODUCT_QUANTITY": 1,
            "NATIONAL_TYPE": 1
         }

         axios.post(GetOrderPriceUrl, order_info)
         .then( response => {
            //if get price response ok
            if (response && response.data) {
               resolve(response.data);
            }
            // resolve('NLP success');
         })
         .catch( err => {
            // if has error while get price
            resolve({ error: true });
         })
      })
   });

   return Promise.all(listGetPricePromise);
}

async function insertMultipleOrder(list_item, inventory, token) {
   const listInsertOrderPromise = list_item.map( function(item) {
      return new Promise ((resolve, reject) => {
         let order_payment = 0;

         if (item.order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
            if (item.order.TIEN_THU_HO == 0) {
               order_payment = 4;
            } else {
               order_payment = 2;
            }
         } else if (item.order.TIEN_THU_HO == 0) {
            order_payment = 1;
         } else {
            order_payment = 3;
         }
         // console.log("order_payment: ", order_payment);
         let order_insert = {
            "ORDER_NUMBER": item.order.MA_DON_HANG ? item.order.MA_DON_HANG : "",
            "GROUPADDRESS_ID": inventory.GROUPADDRESS_ID,
            "CUS_ID": inventory.CUS_ID,
            "DELIVERY_DATE": formatDateTime(new Date()),
            "SENDER_FULLNAME": inventory.NAME,
            "SENDER_ADDRESS": inventory.ADDRESS,
            "SENDER_PHONE": inventory.PHONE,
            "SENDER_EMAIL": "c.phamquang@e-comservice.com",
            "SENDER_WARD": Number(inventory.WARDS_ID),
            "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
            "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
            "SENDER_LATITUDE": 0,
            "SENDER_LONGITUDE": 0,
            "RECEIVER_FULLNAME": item.order.TEN_NGUOI_NHAN,
            "RECEIVER_ADDRESS": item.order.DIACHI_KHNHAN,
            "RECEIVER_PHONE": item.order.DIEN_THOAI_KHNHAN,
            "RECEIVER_EMAIL": "",
            "RECEIVER_WARD": item.NLP.RECEIVER_WARD,
            "RECEIVER_DISTRICT": item.NLP.RECEIVER_DISTRICT,
            "RECEIVER_PROVINCE": item.NLP.RECEIVER_PROVINCE,
            "RECEIVER_LATITUDE": 0,
            "RECEIVER_LONGITUDE": 0,
            "PRODUCT_NAME": item.order.NOI_DUNG_HANG_HOA,
            "PRODUCT_DESCRIPTION": "",
            "PRODUCT_QUANTITY": 1,
            "PRODUCT_PRICE": item.order.TRI_GIA_HANG,
            "PRODUCT_WEIGHT": item.order.TRONG_LUONG_GRAM,
            "PRODUCT_TYPE": "HH",
            "ORDER_PAYMENT": order_payment,
            "ORDER_SERVICE": item.order.DICH_VU.split('-')[0].trim(),
            "ORDER_SERVICE_ADD": item.order.DICH_VU_KHAC ? item.order.DICH_VU_KHAC : "",
            "ORDER_VOUCHER": 0,
            "ORDER_NOTE": "",
            "MONEY_COLLECTION": item.order.TIEN_THU_HO,
            "MONEY_TOTALFEE": 0,
            "MONEY_FEECOD": 0,
            "MONEY_FEEVAS": 0,
            "MONEY_FEEINSURRANCE": 0,
            "MONEY_FEE": 0,
            "MONEY_FEEOTHER": 0,
            "MONEY_TOTALVAT": 0,
            "MONEY_TOTAL": 0
         }

         axios.post(InsertOrderUrl, order_insert,  { headers: { "Token":  token} })
         .then( response => {
            //if get price response ok
            if (response && response.data) {
               resolve(response.data);
            }
            // resolve('NLP success');
         })
         .catch( err => {
            // if has error while get price
            resolve({ error: true, status: 400 });
         })
      })
   });

   return Promise.all(listInsertOrderPromise);
}




// END OF TEST



router.post('/upload', exelUpoad.single('file'), function (req, res) {
   // console.log(req.body);
   console.log(req.file);

   if(req.file) {
        if (req.headers.token == undefined) {
            //delete file
            fs.unlink(baseExcelFolderPathByDay + req.file.filename, (err) => {
                console.log('successfully deleted ' + baseExcelFolderPathByDay + req.file.filename);
            });
            return res.status(400).send({ status: 400, error: true, message: "No token provided", data: null });

        };
        if (req.body.inventory == undefined) {
            // delete file
            fs.unlink(baseExcelFolderPathByDay + req.file.filename, (err) => {
               console.log('successfully deleted ' + baseExcelFolderPathByDay + req.file.filename);
            });
            return res.status(400).send({ status: 400, error: true, message: "inventory is undefined", data: null });
        }

        let { inventory } = req.body;
        inventory = JSON.parse(inventory);
        let standardHeader = [
            'DIEN_THOAI_KHNHAN',
            'TEN_NGUOI_NHAN',
            'DIACHI_KHNHAN',
            'TINH_DEN',
            'QUAN_DEN',
            'NOI_DUNG_HANG_HOA',
            'TRONG_LUONG_GRAM',
            'TRI_GIA_HANG',
            'NGUOI_NHAN_TRA_CUOC',
            'TIEN_THU_HO',
            'DICH_VU',
            'DICH_VU_KHAC',
            'XEM_HANG',
            'YEU_CAU_KHI_GIAO',
            'MA_DON_HANG'
        ];
      // console.log(req.file);
        if (req.file.size > MAX_FILE_SIZE) {
            // delêt file when file size ís large
            fs.unlink(baseExcelFolderPathByDay + req.file.filename, (err) => {
                console.log('successfully deleted ' + baseExcelFolderPathByDay + req.file.filename);
            });
            return res.status(200).send({ status:200, message: "Dung lượng file không được lớn hơn 1MB", error: true });
        }


        let nextDay = new Date();
        let concatPath = nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear() + '/';

      // Parse a buffer
      const workSheetsFromBuffer = xlsx.parse(path.join(__root, 'public/xlsx/' + concatPath + req.file.filename));
      // Parse a file
      const workSheetsFromFile = xlsx.parse(path.join(__root, 'public/xlsx/' + concatPath + req.file.filename));

      exelObject = [];

      // get data from 1st sheet
      let sheet = workSheetsFromFile[0].data;

      //get column name correspond to 1st row of 1st sheet
      let header = sheet[0];
      // console.log(header);
      let numberHeaderColumnMatch = 0;

      //check if header of file match standardHeader
      for (let i = 0; i < header.length; i++) {
         if (standardHeader.includes(header[i])) {
            numberHeaderColumnMatch += 1;
         }
      }

      if(sheet.length <= 501) {
          if (numberHeaderColumnMatch == standardHeader.length) {
             //if header of file upload match standard header
             let list_row_data = [];
             // console.log('sheet[2] = ', sheet[2]);
             // console.log('sheet[2] = ', sheet[2].length);
             let index = 0;
             // add data of row to array
             for (let j = 1; j < sheet.length; j++) {

                let row_data = {};
                if(sheet[j].length){
                   for (let k = 0; k < standardHeader.length; k++) {
                      if (standardHeader[k] == "DIEN_THOAI_KHNHAN") {
                         row_data[standardHeader[k]] = sheet[j][k] ? ( sheet[j][k] ) : "";
                      }
                      else {
                         row_data[standardHeader[k]] = sheet[j][k] ? sheet[j][k] : "";
                      }

                   }
                   row_data = {  'ORDER_NUMBER' : '', ...row_data };

                   list_row_data[index] = {
                      "index": j,
                      "status": "New",
                      "message": [],
                      "order": row_data,
                      "NLP": {
                         "RECEIVER_WARD": 0,
                         "RECEIVER_DISTRICT": 0,
                         "RECEIVER_PROVINCE": 0,
                      },
                      "FEE": {
                         "MONEY_TOTALFEE": 0,
                         "MONEY_FEE": 0,
                         "MONEY_FEECOD": 0,
                         "MONEY_TOTALVAT": 0,
                         "MONEY_TOTAL": 0,
                      }
                   }

                   index ++;
                }

             }
             // console.log(inventory);
             // data structure of row
             console.log(new Date());
             var obj = {
                "header": standardHeader,
                "inventory": inventory,
                "content": list_row_data,
                "cusId": inventory.CUS_ID,
                "rowCount": sheet.length - 1,
                "GUI_ID": inventory.GUI_ID,
                "uploadTime": new Date(),
                "fileName": req.file.filename,
                "originalName": req.file.originalname,
                "status": 'Uploaded',
                "token": req.headers.token
             }
             // complete parse all row to object
             exelObject.push(obj);
             // }

             UploadExel.create(exelObject, function (err, cb) {
                if(err) return res.status(500).send({ status: 500, error: true, message: "Can not upload file exel", data: null });
                return res.status(200).send({status: 200, error: false, message: "Upload file exel success", data: null});
             })
          }
          else {
               // if header of file upload not match standard header -> delete file
                fs.unlink(baseExcelFolderPathByDay + req.file.filename, (err) => {
                  console.log('successfully deleted ' + baseExcelFolderPathByDay + req.file.filename);
                  return res.status(200).send({ status:200, message: "File thiếu một trong các cột sau DIEN_THOAI_KHNHAN,TEN_NGUOI_NHAN, "
                     + "DIACHI_KHNHAN, TINH_DEN, QUAN_DEN, NOI_DUNG_HANG_HOA, TRONG_LUONG_GRAM, TRI_GIA_HANG, "
                     + "NGUOI_NHAN_TRA_CUOC, TIEN_THU_HO, DICH_VU, DICH_VU_KHAC, XEM_HANG, YEU_CAU_KHI_GIAO, MA_DON_HANG", error: true });
                });

          }
      } else {
          return res.status(200).send({status: 200, error: true, message: "Số đơn trong file tải lên không được lớn hơn 500 đơn", data: null});
      }


   } else {
      return res.status(400).send({ status:400, message: "File is not choosen", error: true });
   }
})




// router.post('/create', function (req, res) {
//    UploadExel.create(req.body , function (err, cb) {
//       if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
//       res.status(200).send({status: 200, error: false, message: "success", data: cb});
//    })
// })

//EXPORT EXEL FILE
router.post('/export', function(req, res) {
   let { file_id } = req.body;
   if(file_id == undefined) {
      return res.status(400).send({ status: 400, error: true, message: "file_id is undefined", data: null });
   }
   console.log(file_id);
   var exelData = [];

   UploadExel.findOne({ "_id": file_id }).exec( function(err, data) {
      // console.log(data);
      if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      if(!data) return res.status(200).send({ status: 200, error: true, message: `file_id ${file_id} not exists`, data: null });

      let header = data.header;
      // push column name
      exelData.push(header);

      // console.log(header);
      // Object.keys(header).forEach( k => {
      //    console.log(header[k]);
      // })
      for (let i = 0; i < data.content.length; i++ ) {
         let rowExel = [];
         let row = data.content[i].order;

         // add data to row and correspond to column
         for (let j = 0; j < header.length; j++) {
            let childRow = [];
            childRow.push(row[header[j]]);
            rowExel.push(childRow);
         }

         // add all row to excel file
         exelData.push(rowExel);
      }

      let buffer = xlsx.build([{name: "List User", data: exelData }]); // Returns a buffer
      // res.attachment('users.xlsx');
      let date = new Date();
      let name = 'export-' + date.getTime();
      let filename = `${name}.xlsx`;
      fs.writeFile(`public/xlsx/${filename}`, buffer, function (err) {
         if (err) {
            //if write file error
            return res.status(200).send({ status: 200, error: true, message: `write file error, try it again`, data: null });
         }
         // else return res.render('index', {link: `/xlsx/${filename}`, name: filename});
         else {
            FileManagement.create({
                create_time: new Date(),
                path: `/xlsx/${filename}`
            }, function (err, cb) {

                if (err) {
                    return res.status(500).send({ status: 500, error: true, message: "Can not connect to server", data: null });
                }
                let buff = new Buffer(`/xlsx/${filename}`);
                return res.status(200).send({
                    status: 200,
                    error: false,
                    message: "success",
                    download_url: '/download/' + buff.toString('base64'),
                    data: { download_url: '/download/' + buff.toString('base64') }
                });
            })
         }
         // return res.redirect(`/xlsx/${filename}`);
         // else return res.render('index');
      });
      // res.send(buffer);
   })
})

// router.get('/download/:code', function(req, res) {
//     console.log(req.params.code);
//     let buff = new Buffer(req.params.code, 'base64');
//     console.log(buff.toString('ascii'));
//     res.redirect(buff.toString('ascii'));
// });

router.post('/get_all', async function (req, res) {
   // req.body = { cus_id: '111111111111111111' }
   UploadExel.find().exec(function (err, cb) {
      if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      res.status(200).send({ status: 200, error: false, message: "success", data: cb});
   })
})

router.post('/get_by_cus_id', function (req, res) {
   // req.body = { cus_id: '111111111111111111' }
   if(req.body.cus_id == undefined) {
      return res.status(400).send({ status: 400, error: true, message: "CusId is undefined", data: null });
   }
   UploadExel.find({ cusId: req.body.cus_id }).exec(function (err, cb) {
      if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      res.status(200).send({status: 200, error: false, message: "success", data: cb.length ? cb : null});
   })
});

router.post('/edit_order_item', async function (req, res) {
   console.log('Start edit order item');
   try {
      let { file_id, order, index } = req.body;

      if(file_id == undefined){
         return res.status(400).send({status: 400, message: 'file_id is undefined', error: true, data: null });
      }

      if(order == undefined){
         return res.status(400).send({status: 400, message: 'order is undefined', error: true, data: null });
      }

      if(index == undefined){
         return res.status(400).send({status: 400, message: 'index is undefined', error: true, data: null });
      }

      if (!verify.IsNotEmptyOrUndefined(order.RECEIVER_PHONE) || !verify.IsNotEmptyOrUndefined(order.RECEIVER_ADDRESS) || !verify.IsNotNegativeOrUndefined(order.PRODUCT_WEIGHT)) {
         return res.status(400).send({status: 400, message: 'Điện thoại, địa chỉ và trọng lượng hàng bị thiếu hoặc không hợp lệ', error: true, data: null });
      }

      if (!verify.IsNotNegativeOrUndefined(order.RECEIVER_PROVINCE) || !verify.IsNotNegativeOrUndefined(order.RECEIVER_DISTRICT)) {
         return res.status(400).send({status: 400, message: 'Địa chỉ của người nhận chưa đầy đủ', error: true, data: null });
      }

      if (!verify.IsNotNegativeOrUndefined(order.MONEY_COLLECTION)) {
         return res.status(400).send({status: 400, message: 'Tiền thu hộ không hợp lệ', error: true, data: null });
      }


      // check if file_id exists and change status of order item to "Change" then run
      let order_item = {};
      let updateDataOnMongo = await new Promise( (resolve, reject) => {
         UploadExel.findOneAndUpdate(
            { "_id": file_id, "content.index" : index },
            { $set: {
               "content.$.status": "Change",
               "content.$.order.DICH_VU_KHAC": order.ORDER_SERVICE_ADD,
               "content.$.order.DICH_VU": order.ORDER_SERVICE,
               "content.$.order.TEN_NGUOI_NHAN": order.RECEIVER_FULLNAME,
               "content.$.order.DIACHI_KHNHAN": order.RECEIVER_ADDRESS,
               "content.$.order.DIEN_THOAI_KHNHAN": order.RECEIVER_PHONE,
               "content.$.order.NOI_DUNG_HANG_HOA": order.PRODUCT_NAME,
               "content.$.order.TIEN_THU_HO": order.MONEY_COLLECTION,
               "content.$.order.TRI_GIA_HANG": order.PRODUCT_PRICE,
               "content.$.order.TRONG_LUONG_GRAM": order.PRODUCT_WEIGHT,
               "content.$.NLP.RECEIVER_PROVINCE": order.RECEIVER_PROVINCE,
               "content.$.NLP.RECEIVER_DISTRICT": order.RECEIVER_DISTRICT,
               "content.$.NLP.RECEIVER_WARD": order.RECEIVER_WARD,
            }},
            { new: true }
         ).then( (response) =>{
            // if update success
            // console.log(response);
            if (response) {
               order_item = response.content[index-1];
               return resolve('success');
            }
            resolve(`Can not update, file_id ${file_id} not exits`);

         }).catch( err => {
            reject('error');
         })
      });
      //
      if (updateDataOnMongo != "success") {
         return res.status(500).send({status: 500, message: updateDataOnMongo, error: true, data: null });
      }
      // let NLPData = {};
      //
      // let checkNLPResponse = await new Promise((resolve, reject) => {
      //    axios.post(NLP_URL, { addresss: [ order.RECEIVER_ADDRESS ] })
      //    .then( response => {
      //       // if get data from NLP API success
      //       if (response && response.data) {
      //          let data = response.data[0];
      //          if ( !data.province.code && !data.district.code && !data.commune.code) {
      //             return resolve('NLPError')
      //          } else {
      //             NLPData = data;
      //             return resolve('success')
      //          }
      //       }
      //       resolve('Can not get data from NLP API ')
      //    })
      //    .catch(  err =>  {
      //       console.log(err);
      //       reject('Can not connect to server');
      //    })
      // });
      // console.log('Check NLP : ', checkNLPResponse);
      //
      // if (checkNLPResponse != "success") {
      //    return res.status(500).send({status: 500, message: checkNLPResponse, error: true, data: null });
      // }
      let list_status_required = verify.list_status_require;
      let list_status = verify.list_status;
      let message = [];
      // console.log(order_item.order);
      for (let key in order_item.order) {
         if (list_status_required.includes(key) && !order_item.order[key]) {
            console.log(key + '--' + order_item.order[key]);
            message.push(verify.formatMessageError(list_status[key]))
         }
         else if (key == "DIEN_THOAI_KHNHAN" && !verify.IsPhoneNumber(order_item.order[key]) ) {
            message.push("Số điện thoại người nhận không hợp lệ");
         }
      }

      let checkValidateResponse = await new Promise((resolve, reject) => {
         let order_info = {
            "SENDER_PROVINCE": order.SENDER_PROVINCE,
            "SENDER_DISTRICT": order.SENDER_DISTRICT,
            "RECEIVER_PROVINCE": order.RECEIVER_PROVINCE,
            "RECEIVER_DISTRICT": order.RECEIVER_DISTRICT,
            "PRODUCT_TYPE": order.PRODUCT_TYPE,
            "ORDER_SERVICE": order.ORDER_SERVICE.trim(),
            "ORDER_SERVICE_ADD": order.ORDER_SERVICE_ADD.trim(),
            "PRODUCT_WEIGHT": order.PRODUCT_WEIGHT,
            "PRODUCT_PRICE": order.PRODUCT_PRICE,
            "MONEY_COLLECTION": order.MONEY_COLLECTION,
            "PRODUCT_QUANTITY": order.PRODUCT_QUANTITY,
            "NATIONAL_TYPE": 1
        };
        console.log(order_info);

         axios.post(GetOrderPriceUrl, order_info)
         .then( response => {
            console.log("1621. ", response.data);
            // console.log("1450", response.error);
            if (response.data.error) {
               return resolve('Bảng giá không áp dụng cho hàng trình này')
            }
            resolve(response.data)
         })
         .catch( err => {
            console.log(err);
            reject('Bảng giá không áp dụng cho hàng trình này')
         })
      });



      // console.log("Check validate : ", checkValidateResponse);

      if (typeof checkValidateResponse == 'string') {
         message.push(checkValidateResponse);
         UploadExel.findOneAndUpdate(
            { _id: file_id, "content.index": index },
            {  $set: {
               "content.$.status" : "ValidateError",
               "content.$.message" : message,
            }},
            function (err, response) {
               // console.log("response of update validate error ", response);
               if (err || !response) {
                  return res.status(500).send({status: 500, message: 'edit order success but update status on database error', error: true, data: null });
               }
               // console.log('update status validate error');
               // return;
               else {
                  res.status(200).send({ status: 200, message: checkValidateResponse, error: true, data: null });
                  res.end();
               }
            }
         )
         // return res.status(500).send({status: 500, message: checkValidateResponse, error: true, data: null });
      }
      else {
         // console.log("1400", checkValidateResponse);
         // update status "ValidateSuccess" to mongo
         let lenOfListFee = checkValidateResponse.length;
         let fee_other = 0;
         for (let i = 2; i < lenOfListFee - 2; i++) {
            fee_other +=  Number(checkValidateResponse[i].PRICE);
         }
         console.log("1426", message);
         UploadExel.findOneAndUpdate(
            { _id: file_id, "content.index": index },
            {  $set: {
               "content.$.status" : message.length ? "Error" : "ValidateSuccess",
               "content.$.message" : message.length ? message : [],
               "content.$.FEE.MONEY_TOTAL": Number(checkValidateResponse[0].PRICE),
               "content.$.FEE.MONEY_TOTALVAT": Number(checkValidateResponse[1].PRICE),
               "content.$.FEE.MONEY_TOTALFEE": Number(checkValidateResponse[lenOfListFee - 1].PRICE),
               "content.$.FEE.MONEY_FEE": Number(checkValidateResponse[lenOfListFee - 2].PRICE),
               "content.$.FEE.MONEY_FEECOD": fee_other,
               "content.$.NLP.RECEIVER_PROVINCE": order.RECEIVER_PROVINCE,
               "content.$.NLP.RECEIVER_DISTRICT": order.RECEIVER_DISTRICT,
               "content.$.NLP.RECEIVER_WARD": order.RECEIVER_WARD
            }},
            function (err, response) {
               // console.log("response of edit ", response);
               if (err || !response) {
                  return res.status(500).send({status: 500, message: 'edit order success but update status on database error', error: true, data: null });
               } else {
                  res.status(200).send({status: 200, message: 'edit order success', error: false, data: null });
                  res.end();
               }

            }
         )
      }





      // UploadExel.update(
      //    { "_id": file_id },
      //    { $set: {  "status": "Change"  }  }
      // ).then( updateItemResponse =>{
      //    console.log('updateresponse', updateItemResponse);
      //    if (updateItemResponse) {
      //       return res.status(200).send({status: 200, message: 'upload list order success and waiting for worker response', error: false, data: null });
      //    }
      //    return res.status(500).send({status: 500, message: 'has error when update order item, please try do it', error: true, data: null });
      // })
      // .catch(err => {
      //    console.log(err);
      //    return res.status(500).send({status: 500, message: 'has error when update order item, please try do it', error: true, data: null });
      // })
   } catch (e) {
      console.log(e);
      return res.status(500).send({status: 500, message: 'has error when update order item, please try do it', error: true, data: null });
   } finally {
      console.log('End of edit order item');
   }


});

router.post('/submit_order', async function (req, res) {
   try {
      let { file_id, index } = req.body;

      if(file_id == undefined){
         return res.status(400).send({status: 400, message: 'file_id is undefined', error: true, data: null });
      }

      if(index == undefined){
         return res.status(400).send({status: 400, message: 'index is undefined', error: true, data: null });
      }

      let orderDataResponse =  await new Promise((resolve, reject) => {
         UploadExel.findOne({ _id: file_id }).exec()
         .then( response => {
            if (response) {
               return resolve(response)
            }
            resolve(`file_id ${file_id} not found`);
         })
         .catch( err => {
            reject('Can not connect to server')
         })
      });

      // if get data from database error
      if (typeof orderDataResponse == "string") {
         return  res.status(500).send({status: 500, message: orderDataResponse, error: true, data: null });
      }

      // if get data from database success
      let orderNumber = 0;
      // console.log(orderDataResponse);

      let createOrderResponse = await new Promise((resolve, reject) => {
         let order_payment = 0, order = orderDataResponse.content[index-1].order, inventory = orderDataResponse.inventory;

         if (order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
            if (order.TIEN_THU_HO == 0) {
               order_payment = 4;
            } else {
               order_payment = 2;
            }
         } else if (order.TIEN_THU_HO == 0) {
            order_payment = 1;
         } else {
            order_payment = 3;
         }

         let order_insert = {
            "ORDER_NUMBER": order.MA_DON_HANG ? order.MA_DON_HANG : "",
            "GROUPADDRESS_ID": inventory.GROUPADDRESS_ID,
            "CUS_ID": inventory.CUS_ID,
            "DELIVERY_DATE": formatDateTime(new Date()),
            "SENDER_FULLNAME": inventory.NAME,
            "SENDER_ADDRESS": inventory.ADDRESS,
            "SENDER_PHONE": inventory.PHONE,
            "SENDER_EMAIL": "c.phamquang@e-comservice.com",
            "SENDER_WARD": Number(inventory.WARDS_ID),
            "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
            "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
            "SENDER_LATITUDE": 0,
            "SENDER_LONGITUDE": 0,
            "RECEIVER_FULLNAME": order.TEN_NGUOI_NHAN,
            "RECEIVER_ADDRESS": order.DIACHI_KHNHAN,
            "RECEIVER_PHONE": order.DIEN_THOAI_KHNHAN,
            "RECEIVER_EMAIL": "",
            "RECEIVER_WARD": orderDataResponse.content[index-1].NLP.RECEIVER_WARD,
            "RECEIVER_DISTRICT": orderDataResponse.content[index-1].NLP.RECEIVER_DISTRICT,
            "RECEIVER_PROVINCE": orderDataResponse.content[index-1].NLP.RECEIVER_PROVINCE,
            "RECEIVER_LATITUDE": 0,
            "RECEIVER_LONGITUDE": 0,
            "PRODUCT_NAME": order.NOI_DUNG_HANG_HOA,
            "PRODUCT_DESCRIPTION": "",
            "PRODUCT_QUANTITY": 1,
            "PRODUCT_PRICE": order.TRI_GIA_HANG,
            "PRODUCT_WEIGHT": order.TRONG_LUONG_GRAM,
            "PRODUCT_TYPE": "HH",
            "ORDER_PAYMENT": order_payment,
            "ORDER_SERVICE": order.DICH_VU.split('-')[0].trim(),
            "ORDER_SERVICE_ADD": order.DICH_VU_KHAC ? order.DICH_VU_KHAC : "",
            "ORDER_VOUCHER": 0,
            "ORDER_NOTE": "",
            "MONEY_COLLECTION": order.TIEN_THU_HO,
            "MONEY_TOTALFEE": 0,
            "MONEY_FEECOD": 0,
            "MONEY_FEEVAS": 0,
            "MONEY_FEEINSURRANCE": 0,
            "MONEY_FEE": 0,
            "MONEY_FEEOTHER": 0,
            "MONEY_TOTALVAT": 0,
            "MONEY_TOTAL": 0
         }
         axios.post(InsertOrderUrl, order_insert, {  headers: { 'Token': orderDataResponse.token} })
         .then( response => {
            if ( !response.data.error && response.data.status == 200) {
               orderNumber = response.data.data.ORDER_NUMBER;
               console.log(orderNumber);
               return resolve('success')
            }

            resolve(response.data.message)
         })
         .catch( err => {
            reject('Can not connect to server')
         })
      });

      console.log(createOrderResponse);

      if (createOrderResponse == 'success') {
         // if create order success
         UploadExel.findOneAndUpdate(
            { _id: file_id, "content.index": index },
            {  $set: { "content.$.status" : "Completed","content.$.order.ORDER_NUMBER" : orderNumber }},
            function (response) {
               if (response) {
                  return res.status(500).send({status: 500, message: 'Cập nhật trạng thái đơn không thành công', error: true, data: null });
               }
               return res.status(200).send({status: 200, message: 'Tạo đơn thành công', error: false, data: null });
            }
         )
      }
      else {
         // if create order error
         UploadExel.findOneAndUpdate(
            { _id: file_id, "content.index": index },
            {  $set: { "content.$.status" : "CreateOrderError" }},
            function (response) {
               if (response) {
                  return res.status(500).send({status: 500, message: 'Cập nhật trạng thái đơn không thành công', error: true, data: null });
               }
               return res.status(200).send({status: 200, message: 'Tạo đơn không thành công', error: true, data: null });
            }
         )
      }
   } catch (e) {
      console.log(e);
      return res.status(500).send({status: 500, message: 'Đã có lỗi xảy ra khi tạo đơn, vui lòng thử lại', error: true, data: null });
   } finally {

   }
})

router.post('/submit_multi_order', async function (req, res) {
   try {
      let { file_id, list_index } = req.body;

      if(file_id == undefined){
         return res.status(400).send({status: 400, message: 'file_id is undefined', error: true, data: null });
      }

      if(list_index == undefined){
         return res.status(400).send({status: 400, message: 'list_index is undefined', error: true, data: null });
      }

      if(list_index.length == 0){
         return res.status(400).send({status: 400, message: 'list_index is empty', error: true, data: null });
      }

      let orderDataResponse =  await new Promise((resolve, reject) => {
         UploadExel.findOne({ _id: file_id }).exec()
         .then( response => {
            if (response) {
               return resolve(response)
            }
            resolve(`file_id ${file_id} not found`);
         })
         .catch( err => {
            reject('Can not connect to server')
         })
      });

      // if get data from database error
      if (typeof orderDataResponse == "string") {
         return  res.status(500).send({status: 500, message: orderDataResponse, error: true, data: null });
      }

      // if get data from database success
      let orderNumber = 0;
      // console.log(orderDataResponse);

      let listPromise = list_index.map( function(index) {
         return new Promise((resolve, reject) => {
            let order_payment = 0,
               order = orderDataResponse.content[index-1].order,
               fee = orderDataResponse.content[index-1].FEE,
               inventory = orderDataResponse.inventory;

            if (order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
               if (order.TIEN_THU_HO == 0) {
                  order_payment = 4;
               } else {
                  order_payment = 2;
               }
            } else if (order.TIEN_THU_HO == 0) {
               order_payment = 1;
            } else {
               order_payment = 3;
            }

            let order_insert = {
               "ORDER_NUMBER": order.MA_DON_HANG ? order.MA_DON_HANG : "",
               "GROUPADDRESS_ID": inventory.GROUPADDRESS_ID,
               "CUS_ID": inventory.CUS_ID,
               "DELIVERY_DATE": formatDateTime(new Date()),
               "SENDER_FULLNAME": inventory.NAME,
               "SENDER_ADDRESS": inventory.ADDRESS,
               "SENDER_PHONE": inventory.PHONE,
               "SENDER_EMAIL": "c.phamquang@e-comservice.com",
               "SENDER_WARD": Number(inventory.WARDS_ID),
               "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
               "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
               "SENDER_LATITUDE": 0,
               "SENDER_LONGITUDE": 0,
               "RECEIVER_FULLNAME": order.TEN_NGUOI_NHAN,
               "RECEIVER_ADDRESS": order.DIACHI_KHNHAN,
               "RECEIVER_PHONE": order.DIEN_THOAI_KHNHAN,
               "RECEIVER_EMAIL": "",
               "RECEIVER_WARD": orderDataResponse.content[index-1].NLP.RECEIVER_WARD,
               "RECEIVER_DISTRICT": orderDataResponse.content[index-1].NLP.RECEIVER_DISTRICT,
               "RECEIVER_PROVINCE": orderDataResponse.content[index-1].NLP.RECEIVER_PROVINCE,
               "RECEIVER_LATITUDE": 0,
               "RECEIVER_LONGITUDE": 0,
               "PRODUCT_NAME": order.NOI_DUNG_HANG_HOA,
               "PRODUCT_DESCRIPTION": "",
               "PRODUCT_QUANTITY": 1,
               "PRODUCT_PRICE": order.TRI_GIA_HANG,
               "PRODUCT_WEIGHT": order.TRONG_LUONG_GRAM,
               "PRODUCT_TYPE": "HH",
               "ORDER_PAYMENT": order_payment,
               "ORDER_SERVICE": order.DICH_VU.split('-')[0].trim(),
               "ORDER_SERVICE_ADD": order.DICH_VU_KHAC ? order.DICH_VU_KHAC : "",
               "ORDER_VOUCHER": 0,
               "ORDER_NOTE": "",
               "MONEY_COLLECTION": order.TIEN_THU_HO,
               "MONEY_TOTALFEE": fee.MONEY_TOTALFEE,
               "MONEY_FEECOD": fee.MONEY_FEECOD,
               "MONEY_FEEVAS": 0,
               "MONEY_FEEINSURRANCE": 0,
               "MONEY_FEE": fee.MONEY_FEE,
               "MONEY_FEEOTHER": 0,
               "MONEY_TOTALVAT": fee.MONEY_TOTALVAT,
               "MONEY_TOTAL": fee.MONEY_TOTAL
            }
            axios.post(InsertOrderUrl, order_insert, {  headers: { 'Token': orderDataResponse.token} })
            .then( response => {
               if ( !response.data.error && response.data.status == 200) {
                  // orderNumber = response.data.data.ORDER_NUMBER;
                  console.log(orderNumber);
                  return resolve({  error: false, order_number:  response.data.data.ORDER_NUMBER, index: index})
               }

               resolve({ error: true, message: response.data.message, index: index})
            })
            .catch( err => {
               reject({ error: true, message: 'Can not connect to server', index: index})
            })
         });
      })

      let createOrderResponse = await Promise.all(listPromise);

      let updateStatusInsertOrderPromise = createOrderResponse.map( function (response) {
         return new Promise((resolve, reject) => {
            // let status = response.error ? 'CreateOrderError' : 'Completed';
            // console.log(response);
            if (response.error) {
               //if insert order error
               UploadExel.findOneAndUpdate(
                  { _id: file_id, "content.index": response.index },
                  {  $set: { "content.$.status" : "CreateOrderError" }}
               ).exec()
               .then( resp => {
                  if (resp) return resolve('success');
                  reject('error');
               })
               .catch( err => {
                  reject('error');
               })
            }

            else {
               // if insert order success
               UploadExel.findOneAndUpdate(
                  { _id: file_id, "content.index": response.index },
                  {  $set: { "content.$.status" : "Completed", "content.$.order.ORDER_NUMBER" : response.order_number }}
               ).exec()
               .then( resp => {
                  if (resp) return resolve('success');
                  reject('error');
               })
               .catch( err => {
                  reject('error');
               })
            }

         });
      })

      let updateStatusInsertOrderResponse =  await Promise.all(updateStatusInsertOrderPromise);
      console.log(updateStatusInsertOrderResponse);

      if (updateStatusInsertOrderResponse.includes('error')) {
         return res.status(500).send({status: 500, message: 'update order status to database erro, try it again', error: true, data: createOrderResponse });
      }

      return res.status(200).send({status: 200, message: 'result of submit all order', error: false, data: createOrderResponse });

      // console.log(createOrderResponse);

   } catch (e) {
      console.log(e);
      return res.status(500).send({status: 500, message: 'Đã có lỗi xảy ra khi tạo đơn, vui lòng thử lại', error: true, data: null });
   } finally {

   }
})

router.post('/submit_all_order', async function (req, res) {
   try {
      let { file_id } = req.body;

      if(file_id == undefined){
         return res.status(400).send({status: 400, message: 'file_id is undefined', error: true, data: null });
      }

      let orderDataResponse =  await new Promise((resolve, reject) => {
         UploadExel.findOne({ _id: file_id }).exec()
         .then( response => {
            if (response) {
               return resolve(response)
            }
            resolve(`file_id ${file_id} not found`);
         })
         .catch( err => {
            reject('Can not connect to server')
         })
      });

      // if get data from database error
      if (typeof orderDataResponse == "string") {
         return  res.status(500).send({status: 500, message: orderDataResponse, error: true, data: null });
      }

      // if get data from database success
      let orderNumber = 0;
      // console.log(orderDataResponse);
      let list_order = [];
      for (let i = 0; i < orderDataResponse.content.length; i++) {
         if (orderDataResponse.content[i].status == "ValidateSuccess") {
            list_order.push(orderDataResponse.content[i]);
         }
      }
      if (list_order.length == 0) {
         return res.status(200).send({status: 200, message: 'Không tồn tại đơn hợp lệ để tạo', error: true, data: null });
      }

      let inventory = orderDataResponse.inventory;

      let listPromise = list_order.map( function(item) {
         return new Promise((resolve, reject) => {
            let order_payment = 0, order = item.order, fee = item.FEE;

            if (order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
               if (order.TIEN_THU_HO == 0) {
                  order_payment = 4;
               } else {
                  order_payment = 2;
               }
            } else if (order.TIEN_THU_HO == 0) {
               order_payment = 1;
            } else {
               order_payment = 3;
            }

            let order_insert = {
               "ORDER_NUMBER": order.MA_DON_HANG ? order.MA_DON_HANG : "",
               "GROUPADDRESS_ID": inventory.GROUPADDRESS_ID,
               "CUS_ID": inventory.CUS_ID,
               "DELIVERY_DATE": formatDateTime(new Date()),
               "SENDER_FULLNAME": inventory.NAME,
               "SENDER_ADDRESS": inventory.ADDRESS,
               "SENDER_PHONE": inventory.PHONE,
               "SENDER_EMAIL": "c.phamquang@e-comservice.com",
               "SENDER_WARD": Number(inventory.WARDS_ID),
               "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
               "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
               "SENDER_LATITUDE": 0,
               "SENDER_LONGITUDE": 0,
               "RECEIVER_FULLNAME": order.TEN_NGUOI_NHAN,
               "RECEIVER_ADDRESS": order.DIACHI_KHNHAN,
               "RECEIVER_PHONE": order.DIEN_THOAI_KHNHAN,
               "RECEIVER_EMAIL": "",
               "RECEIVER_WARD": item.NLP.RECEIVER_WARD,
               "RECEIVER_DISTRICT": item.NLP.RECEIVER_DISTRICT,
               "RECEIVER_PROVINCE": item.NLP.RECEIVER_PROVINCE,
               "RECEIVER_LATITUDE": 0,
               "RECEIVER_LONGITUDE": 0,
               "PRODUCT_NAME": order.NOI_DUNG_HANG_HOA,
               "PRODUCT_DESCRIPTION": "",
               "PRODUCT_QUANTITY": 1,
               "PRODUCT_PRICE": order.TRI_GIA_HANG,
               "PRODUCT_WEIGHT": order.TRONG_LUONG_GRAM,
               "PRODUCT_TYPE": "HH",
               "ORDER_PAYMENT": order_payment,
               "ORDER_SERVICE": order.DICH_VU.split('-')[0].trim(),
               "ORDER_SERVICE_ADD": order.DICH_VU_KHAC ? order.DICH_VU_KHAC : "",
               "ORDER_VOUCHER": 0,
               "ORDER_NOTE": "",
               "MONEY_COLLECTION": order.TIEN_THU_HO,
               "MONEY_TOTALFEE": fee.MONEY_TOTALFEE,
               "MONEY_FEECOD": fee.MONEY_FEECOD,
               "MONEY_FEEVAS": 0,
               "MONEY_FEEINSURRANCE": 0,
               "MONEY_FEE": fee.MONEY_FEE,
               "MONEY_FEEOTHER": 0,
               "MONEY_TOTALVAT": fee.MONEY_TOTALVAT,
               "MONEY_TOTAL": fee.MONEY_TOTAL
            }
            axios.post(InsertOrderUrl, order_insert, {  headers: { 'Token': orderDataResponse.token} })
            .then( response => {
               if ( !response.data.error && response.data.status == 200) {
                  // orderNumber = response.data.data.ORDER_NUMBER;
                  console.log(orderNumber);
                  return resolve({  error: false, order_number:  response.data.data.ORDER_NUMBER, index: item.index})
               }

               resolve({ error: true, message: response.data.message, index: item.index})
            })
            .catch( err => {
               reject({ error: true, message: 'Can not connect to server', index: item.index})
            })
         });
      })

      // get all response of submit all order
      let createOrderResponse = await Promise.all(listPromise);

      let numberCreateError = 0, numberCreateSuccess = 0;

      let updateStatusInsertOrderPromise = createOrderResponse.map( function (response) {
         return new Promise((resolve, reject) => {
            // let status = response.error ? 'CreateOrderError' : 'Completed';
            // console.log(response);
            if (response.error) {
               //if insert order error
               UploadExel.findOneAndUpdate(
                  { _id: file_id, "content.index": response.index },
                  {  $set: { "content.$.status" : "CreateOrderError" }}
               ).exec()
               .then( resp => {
                  if (resp) {
                     numberCreateError += 1;
                     return resolve('success');
                  }
                  reject('error');
               })
               .catch( err => {
                  reject('error');
               })
            }

            else {
               // if insert order success
               UploadExel.findOneAndUpdate(
                  { _id: file_id, "content.index": response.index },
                  {  $set: { "content.$.status" : "Completed", "content.$.order.ORDER_NUMBER" : response.order_number }}
               ).exec()
               .then( resp => {
                  if (resp) {
                     numberCreateSuccess += 1;
                     return resolve('success');
                  }
                  reject('error');
               })
               .catch( err => {
                  reject('error');
               })
            }

         });
      })

      let updateStatusInsertOrderResponse =  await Promise.all(updateStatusInsertOrderPromise);
      console.log(updateStatusInsertOrderResponse);


      if (updateStatusInsertOrderResponse.includes('error')) {
         return res.status(500).send({status: 500, message: 'Đã có lỗi xảy ra khi tạo đơn, vui lòng thử lại', error: true, data: createOrderResponse });
      }

      return res.status(200).send({
         status: 200,
         message: 'submit all order finish',
         error: false,
         data: {
            orders: createOrderResponse,
            total_success: numberCreateSuccess,
            total_error: numberCreateError
         }
      });

      // console.log(createOrderResponse);

   } catch (e) {
      console.log(e);
      return res.status(500).send({status: 500, message: 'Đã có lỗi xảy ra khi tạo đơn, vui lòng thử lại', error: true, data: null });
   } finally {
      //finish
   }
})
// async function submitAllOrder()

function checkNLP(list_address) {
   // console.log(list_address);
   return new Promise( (resolve, reject) => {
      axios.post(NLP_URL, { addresss: list_address})
      .then( response => {
         if (response.data.length) {
            resolve({
               error: false,
               data: response.data
            })
         } else {
            resolve({ error: true, data: null })
         }

      })
      .catch( err => {
         console.log(err);
         reject({ error: true, data: null })
      })
   })
}



router.post('/get_detail', function (req, res) {
   // req.body = { id: '111111111111111111' }
   let { file_id, list_status, page_size, page_index } = req.body
   if(file_id == undefined){
      return res.status(400).send({status: 400, message: 'file_id is undefined', error: true, data: null });
   }

   if(page_size == undefined){
      return res.status(400).send({status: 400, message: 'page_size is undefined', error: true, data: null });
   }

   if(page_index == undefined){
      return res.status(400).send({status: 400, message: 'page_index is undefined', error: true, data: null });
   }

   if(list_status == undefined){
      return res.status(400).send({status: 400, message: 'list_status is undefined', error: true, data: null });
   }


   let ErrorOrder = 0, NLPError = 0, ValidateError = 0, ValidateSuccess = 0; CreateOrderError = 0, Completed = 0, New = 0, Change = 0, Processing = 0;
   let ListNLPError = [], ListValidateError = [], ListCreateOrderError = [], ListCompleted = [], ListNew = [], ListChange = [];
   // let listStatus = [];
   // if(status == "CreateOrderError") {
   //    listStatus = ['CreateOrderError', 'NLPError', 'ValidateError'];
   // }
   // else listStatus.push(status);

   console.log(file_id);

   UploadExel.findById( file_id, function(err, history) {
      // try {
         if (err) return res.status(500).send({status: 500, message: 'Can not connect to server', error: true, data: null });
         if (!history) return res.status(200).send({status: 200, message: 'File not found', error: true, data: null });
         let list_order_detail = [], list_receiver_address = [];
         let minIndex = page_size * (page_index - 1);
         let maxIndex =  minIndex + page_size;
         let numberOrderMatchStatus = 0;

         if (list_status.length == 0) {
            list_status = ["New", "Processing", "NLPError", "ValidateError", "ValidateSuccess", "CreateOrderError", "Completed"];
         }

         for (let i = 0; i < history.content.length; i++) {
            // if (history.content[i]) {

               let item = history.content[i];
               let inventory = history.inventory;
               let order = item.order, fee = item.FEE;
               // console.log("item status",item.status);

               if (list_status.includes(item.status)) {
                  //increase number order if match status
                  numberOrderMatchStatus += 1;
                  if (minIndex < numberOrderMatchStatus && numberOrderMatchStatus <= maxIndex ) {
                     list_receiver_address.push(item.order.DIACHI_KHNHAN);
                     let order_payment = 0;
                     if (item.order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
                        if (item.order.TIEN_THU_HO == 0) {
                           order_payment = 4;
                        } else {
                           order_payment = 2;
                        }
                    } else if (item.order.TIEN_THU_HO == 0) {
                        order_payment = 1;
                     } else {
                        order_payment = 3;
                     }

                     // let money_collection = item.order.TIEN_THU_HO;
                      let money_collection = 0;

                     switch (order_payment) {
                         case 1:
                             money_collection = 0;
                             break;
                         case 2:
                             money_collection = convertToNumber(item.order.TIEN_THU_HO) + convertToNumber(fee.MONEY_TOTAL);
                             break;
                         default:
                             money_collection = convertToNumber(fee.MONEY_TOTAL);
                     }
                     // if (order_payment == 2) {
                     //     money_collection = convertToNumber(item.order.TIEN_THU_HO) + convertToNumber(fee.MONEY_TOTAL);
                     // }
                     let order_detail = {
                        "ORDER_NUMBER": item.order.ORDER_NUMBER,
                        "ORDER_REFERENCE": item.order.MA_DON_HANG ? item.order.MA_DON_HANG : "",
                        "GROUPADDRESS_ID": inventory.GROUPADDRESS_ID,
                        "CUS_ID": inventory.CUS_ID,
                        "PARTNER": 0,
                        "DELIVERY_DATE": 0,
                        "DELIVERY_EMPLOYER": 0,
                        "SENDER_FULLNAME": inventory.NAME,
                        "SENDER_ADDRESS": inventory.ADDRESS,
                        "SENDER_PHONE": inventory.PHONE,
                        "SENDER_EMAIL": "",
                        "SENDER_WARD": Number(inventory.WARDS_ID),
                        "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
                        "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
                        "SENDER_LATITUDE": 0,
                        "SENDER_LONGITUDE": 0,
                        "RECEIVER_FULLNAME": item.order.TEN_NGUOI_NHAN,
                        "RECEIVER_ADDRESS": item.order.DIACHI_KHNHAN,
                        "RECEIVER_PHONE": item.order.DIEN_THOAI_KHNHAN.toString(),
                        "RECEIVER_EMAIL": "",
                        "RECEIVER_WARD": item.NLP.RECEIVER_WARD,
                        "RECEIVER_DISTRICT": item.NLP.RECEIVER_DISTRICT,
                        "RECEIVER_PROVINCE": item.NLP.RECEIVER_PROVINCE,
                        "RECEIVER_LATITUDE": 0,
                        "RECEIVER_LONGITUDE": 0,
                        "PRODUCT_NAME": item.order.NOI_DUNG_HANG_HOA,
                        "PRODUCT_DESCRIPTION": "",
                        "PRODUCT_QUANTITY": 1,
                        "PRODUCT_PRICE": convertToNumber(item.order.TRI_GIA_HANG),
                        "PRODUCT_WEIGHT": convertToNumber(item.order.TRONG_LUONG_GRAM),
                        "PRODUCT_TYPE": "HH",
                        "ORDER_PAYMENT": order_payment,
                        "ORDER_SERVICE": item.order.DICH_VU.split('-')[0].trim(),
                        "ORDER_SERVICE_ADD": item.order.DICH_VU_KHAC ? item.order.DICH_VU_KHAC : "",
                        "ORDER_VOUCHER": 0,
                        "ORDER_STATUS": 0,
                        "ORDER_NOTE": "",
                        "ORDER_SYSTEMDATE": 0,
                        "ORDER_ACCEPTDATE": 0,
                        "ORDER_SUCCESSDATE": 0,
                        "ORDER_EMPLOYER": -1,
                        "MONEY_COLLECTION": money_collection,
                        "MONEY_TOTALFEE": fee.MONEY_TOTALFEE,
                        "MONEY_FEECOD": fee.MONEY_FEECOD,
                        "MONEY_FEEVAS": 0,
                        "MONEY_FEEINSURRANCE": 0,
                        "MONEY_FEE": fee.MONEY_FEE,
                        "MONEY_FEEOTHER": 0,
                        "MONEY_TOTALVAT": fee.MONEY_TOTALVAT,
                        "MONEY_TOTAL": fee.MONEY_TOTAL,
                        "ORDER_TYPE": 0,
                        "POST_CODE": "",
                        "SENDER_POST_CODE": "-/-",
                        "SERVICE_NAME": item.order.DICH_VU,
                        "PROVINCE_CODE": item.order.TINH_DEN,
                        "DISTRICT_NAME": item.order.QUAN_DEN.split('-')[0],
                        "DISTRICT_CODE": item.order.QUAN_DEN.split('-')[1],
                        "WARDS_CODE": "",
                        "IS_PENDING": 0,
                        "ORDER_ACTION_505": 0,
                        "FEE_COLLECTED": 0,
                        "COLLECTED_NAME": "",
                        "COLLECTED_ADDRESS": "",
                        "LIST_ITEM": [
                          {
                            "ORDER_NUMBER_ITEM": "",
                            "ORDER_NUMBER": item.order.MA_DON_HANG ? item.order.MA_DON_HANG : "",
                            "PRODUCT_NAME": item.order.NOI_DUNG_HANG_HOA,
                            "PRODUCT_PRICE": convertToNumber(item.order.TRI_GIA_HANG),
                            "PRODUCT_WEIGHT": convertToNumber(item.order.TRONG_LUONG_GRAM),
                            "PRODUCT_QUANTITY": 1
                          }
                       ],
                     }
                     // console.log('2186: ', item.message);

                     list_order_detail.push({ "order": order_detail, "index": item.index, "status": item.status, "message":  item.message});
                  }
               }

            // }
         }

         // let NLPResponse = await checkNLP(list_receiver_address);
         // console.log(NLPResponse);
         //if check NLP success then update receiver address code : province, district, ward
         // if (!NLPResponse.error) {
         //    for (let i = 0; i < list_order_detail.length; i++) {
         //       list_order_detail[i].order.RECEIVER_PROVINCE = NLPResponse.data[i].province.code;
         //       list_order_detail[i].order.RECEIVER_DISTRICT = NLPResponse.data[i].district.code;
         //       list_order_detail[i].order.RECEIVER_WARD = NLPResponse.data[i].commune.code;
         //    }
         // }


         for (let i = 0; i < history.content.length; i++) {
            let order = history.content[i];
            switch (order.status) {
               case "Error":
                  // ListNLPError.push(order);
                  ErrorOrder += 1;
                  break;
               case "NLPError":
                  // ListNLPError.push(order);
                  NLPError += 1;
                  break;
               case "ValidateError":
                  // ListValidateError.push(order);
                  ValidateError += 1;
                  break;
               case "ValidateSuccess":
                  // ListValidateError.push(order);
                  ValidateSuccess += 1;
                  break;
               case "CreateOrderError":
                  // ListCreateOrderError.push(order);
                  CreateOrderError += 1;
                  break;
               case "Completed":
                  // ListCompleted.push(order);
                  Completed += 1;
                  break;
               case "New":
                  // ListNew.push(order);
                  New += 1;
                  break;
               case "Processing":
                  processing += 1;
                  break;
               default:
                  // ListChange.push(order);
                  Change += 1;
            }
         }


         // let list_order = [];
         //
         // for (let i = index; i < index + page_size; i++) {
         //    if (history.content[i] != null) {
         //       list_order.push(history.content[i]);
         //    }
         //
         // }

         res.status(200).send({status: 200, message: 'success', error: false, data: {
            "orders": list_order_detail,
            "total_processing": Processing,
            "total_error": ErrorOrder,
            "total_NLP_error": NLPError,
            "total_validate_error": ValidateError,
            "total_validate_success": ValidateSuccess,
            "total_create_error": CreateOrderError,
            "total_completed": Completed,
            "Total": history.content.length
         }});
      // } catch (e) {
      //    return res.status(500).send({status: 500, message: 'Can not connect to server or something went wrong !!!', error: true, data: null });
      // } finally {
      //
      // }
   })



});

router.post('/history', function(req, res) {
   let { cus_id, page_index, page_size } = req.body;

   if(cus_id == undefined){
      return res.status(400).send({status: 400, message: 'cus_id is undefined', error: true, data: null });
   }

   if(page_size == undefined){
      return res.status(400).send({status: 400, message: 'page_size is undefined', error: true, data: null });
   }

   if(page_index == undefined){
      return res.status(400).send({status: 400, message: 'page_index is undefined', error: true, data: null });
   }

   UploadExel.find({ cusId: cus_id }).sort({uploadTime: -1}).exec(function(err, history) {
      if (err) return res.status(500).send({status: 500, message: 'Can not connect to server', error: true, data: null });
      if (!history) return res.status(200).send({status: 200, message: 'File not found', error: true, data: null });
      // res.send({ data: history })
      let list_file = [];
      let minIndex = page_size * (page_index - 1);
      let maxIndex =  minIndex + page_size;
      console.log(`Number file uploaded by cus_id = ${cus_id} is `, history.length);

      for (let i = minIndex; i < maxIndex; i++) {
         if (history[i]) {
            let ErrorOrder = 0, NLPError = 0, ValidateError = 0, ValidateSuccess = 0, CreateOrderError = 0, Completed = 0, New = 0, Change = 0, Processing = 0;
            for (let j = 0; j < history[i].content.length; j++) {

               let order = history[i].content[j];
               switch (order.status) {
                  case "New":
                     New += 1;
                     break;
                  case "Error":
                     ErrorOrder += 1;
                     break;
                  case "NLPError":
                     NLPError += 1;
                     break;
                  case "ValidateError":
                     ValidateError += 1;
                     break;
                  case "ValidateSuccess":
                     ValidateSuccess += 1;
                     break;
                  case "CreateOrderError":
                     CreateOrderError += 1;
                     break;
                  case "Completed":
                     Completed += 1;
                     break;
                  case "Processing":
                     Processing += 1;
                     break;
                  default:
                     Change += 1;
               }
            }
            list_file.push({
               "fileId": history[i]._id,
               "status": history[i].status,
               "fileName": history[i].filename,
               "uploadTime": formatDateTime(new Date(history[i].uploadTime)),
               "originalName": history[i].originalName,
               "Error": ErrorOrder,
               "NLPError": NLPError,
               "ValidateError": ValidateError,
               "ValidateSuccess": ValidateSuccess,
               "CreateOrderError": CreateOrderError,
               "Completed": Completed,
               "Processing": Processing,
               // "Change": Change,
               "total": history[i].content.length
            });
         }


      }

      res.status(200).send({status: 200, message: 'success', error: false, data: list_file});
   })
});

router.post('/multi-order-export', async function(req, res) {
    try {
        console.log(req.headers);
        const { list_order_number } = req.body;

        if (!req.headers.token) {
            return res.status(400).send({ status: 400, message: 'no token provided', error: true, data: null });
        }

        if(list_order_number == undefined){
           return res.status(400).send({status: 400, message: 'list_order_number is undefined', error: true, data: null });
        }

        if(list_order_number.length == 0 || list_order_number.length > 500){
           return res.status(400).send({status: 400, message: 'list_order_number is empty or over 500 order', error: true, data: null });
        }

        let list = [];
        let prevDate = new Date();
        let listOrderDetail = [];

        // for (let i = 0; i < 100; i++) {
        //     list.push(list_order_number[Math.floor(Math.random()*4)])
        // }
        if (list_order_number.length == 1) {
            listOrderDetail[0] = await new Promise((resolve, reject) => setTimeout( () => {
                axios({
                    method: 'get',
                    url: GetOrderDetailUrl + list_order_number[0],
                    headers: {
                        "token": req.headers.token
                    }
                }).then( response => {
                    // console.log('success');
                    // console.log('response : ', response.data);
                    if (response.data[0]) {
                        return resolve(response.data[0]);
                    }

                    return resolve('error');
                }).catch( err => {
                    console.log(err);
                    return reject('error');
                })
            }), 50);
        } else {
            let listPromises = list_order_number.map( function(orderNumber) {
                return new Promise((resolve, reject) => setTimeout( () => {
                    axios({
                        method: 'get',
                        url: GetOrderDetailUrl + orderNumber,
                        headers: {
                            "token": req.headers.token
                        }
                    }).then( response => {
                        // console.log('success');
                        // console.log('response : ', response.data);
                        if (response.data[0]) {
                            return resolve(response.data[0]);
                        }

                        return resolve('error');
                    }).catch( err => {
                        console.log(err);
                        return reject('error');
                    })
                }), 50);
            })

            listOrderDetail = await Promise.all(listPromises);
        }

        // console.log(listOrderDetail[1].SENDER_ADDRESS);

        if (listOrderDetail.includes('error')) {
            return res.status(500).send({ status: 500, error: true, message: 'can not get order detail on server', data: null })
        }

        let header = [
            'DIEN_THOAI_KHNHAN',
            'TEN_NGUOI_NHAN',
            'DIACHI_KHNHAN',
            'TINH_DEN',
            'QUAN_DEN',
            'NOI_DUNG_HANG_HOA',
            'TRONG_LUONG_GRAM',
            'TRI_GIA_HANG',
            'NGUOI_NHAN_TRA_CUOC',
            'TIEN_THU_HO',
            'DICH_VU',
            'DICH_VU_KHAC',
            'XEM_HANG',
            'YEU_CAU_KHI_GIAO',
            'MA_DON_HANG'
        ];

        let excelDataExport = [];
        excelDataExport.push(header);
        for (let i = 0; i < listOrderDetail.length; i++ ) {
            let order = listOrderDetail[i];
            // if (order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
            //    if (order.TIEN_THU_HO == 0) {
            //       order_payment = 4;
            //    } else {
            //       order_payment = 2;
            //    }
            // } else if (order.TIEN_THU_HO == 0) {
            //    order_payment = 1;
            // } else {
            //    order_payment = 3;
            // }
            let NGUOI_NHAN_TRA_CUOC = '1-Có';
            if (order.ORDER_PAYMENT == 1 || order.ORDER_PAYMENT == 3) {
                NGUOI_NHAN_TRA_CUOC = '2-Không'
            }
            // console.log(order.SENDER_ADDRESS);
           let rowExel = [
               order.RECEIVER_PHONE,
               order.RECEIVER_FULLNAME,
               order.RECEIVER_ADDRESS,
               "",
               "",
               order.PRODUCT_NAME,
               order.PRODUCT_WEIGHT,
               order.PRODUCT_PRICE,
               NGUOI_NHAN_TRA_CUOC,
               order.MONEY_COLLECTION,
               order.ORDER_SERVICE,
               order.ORDER_SERVICE_ADD,
               order.ORDER_NOTE,
               order.ORDER_NOTE,
               order.ORDER_REFERENCE
           ];

           // add all row to excel file
           excelDataExport.push(rowExel);
        }

        let buffer = xlsx.build([{name: "Multi order export", data: excelDataExport }]); // Returns a buffer
        // res.attachment('users.xlsx');
        let date = new Date();
        console.log('time to get multiple request: ', date.getTime() - prevDate.getTime() );
        let name = 'multi-order-export-' + date.getTime();
        let filename = `${name}.xlsx`;
        fs.writeFile(`public/xlsx/multiple-order-export/${filename}`, buffer, function (err) {
           if (err) {
              //if write file error
              return res.status(200).send({ status: 200, error: true, message: `write file error, try it again`, data: null });
           }

           else {

               let filePath = `/xlsx/multiple-order-export/${filename}`;
                FileManagement.create({
                    create_time: new Date(),
                    path: filePath
                }, function (err, cb) {
                    if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server", data: null });
                    let buff = new Buffer(filePath);
                    return res.status(200).send({
                        status: 200,
                        error: false,
                        message: "success",
                        download_url: '/download/' + buff.toString('base64')
                    });
                })

            }
        });
    } catch (e) {
        console.log('error :', e)

    } finally {

    }

})

router.post('/daily-report', function(req, res) {
    let { from_date, to_date } = req.body;

    if(from_date == undefined){
       return res.status(400).send({status: 400, message: 'from_date is undefined', error: true, data: null });
    }

    if(to_date == undefined){
       return res.status(400).send({status: 400, message: 'to_date is undefined', error: true, data: null });
    }

    let start_date =  new Date(from_date);
    let end_date = new Date(to_date);
    DailyReportExcel.find({ date_time : { $gte: start_date.getTime(), $lte: end_date.getTime()  }  }, function(err, reports) {
        if (err) {
            return res.status(500).send({status: 500, message: 'Can not connect to server', error: true, data: null });
        }

        let exelReport = [];
        let header = [ "Ngày", "Số người dùng", "Số file tải lên", "Số đơn thành công", "Số đơn tính giá thành công",
        "Số đơn thiếu thông tin",  "Số đơn lỗi NLP", "Số đơn lỗi tính giá", "Số đơn lỗi tạo đơn"];
        // push column name
        exelReport.push(header);

        // console.log(header);
        // Object.keys(header).forEach( k => {
        //    console.log(header[k]);
        // })


        for (let i = 0; i < reports.length; i++ ) {
            let daily = new Date(reports[i].date_time);
           let rowExel = [
               daily.getDate() + '/' + (daily.getMonth() + 1) + '/' + daily.getFullYear(),
               reports[i].number_user,
               reports[i].number_file,
               reports[i].list_success.create_success,
               reports[i].list_success.validate_success,
               reports[i].list_error.error,
               reports[i].list_error.NLP_error,
               reports[i].list_error.validate_error,
               reports[i].list_error.create_error
           ];

           // add all row to excel file
           exelReport.push(rowExel);
        }

        let buffer = xlsx.build([{name: "Daily Report", data: exelReport }]); // Returns a buffer
        // res.attachment('users.xlsx');
        let date = new Date();
        let name = 'daily-report-' + date.getTime();
        let filename = `${name}.xlsx`;
        fs.writeFile(`public/xlsx/report/${filename}`, buffer, function (err) {
           if (err) {
              //if write file error
              return res.status(200).send({ status: 200, error: true, message: `write file error, try it again`, data: null });
           }

           else {
               let filePath = `/xlsx/report/${filename}`;
               let buff = new Buffer(filePath);
                return res.status(200).send({
                    status: 200,
                    error: false,
                    message: "success",
                    download_url: '/download/' + buff.toString('base64'),
                    data: { download_url: '/download/' + buff.toString('base64')}
                });
            }
        });
        // res.status(200).send({status: 200, message: 'success', error: false, data: reports });
    })
})


async function checkOrderToInsert(array) {
   // check each file one by one
   try {
      for (let item in array) {
         console.log(item + '. ' + array[item]._id);
         await checkListOrder(array[item], array[item].token);
         console.log('------------------------------------------');
      }
   } catch (e) {
      console.log('Error on checkOrderToInsert function');
   } finally {
      console.log('Done!!!!!!!!!!!');
   }

}

async function checkListOrder(list, token) {

   let list_order_id = list._id,
      fileName = list.originalName,
      uploadTime = list.uploadTime;
   try {
      let inventory = list.inventory;
      list = list.content;

      //add address to check NLP
      let listReceiverAddress = [];
      list.map( function(item) {
         listReceiverAddress.push(item.order.DIACHI_KHNHAN);
      })
      // let NLPResult = await axios.post(NLP_URL, { address: listReceiverAddress});
      // console.log(NLPResult);
      let len = list.length;
      for ( let item of list ){
         len = len -1;
         // check each order item one by one
         await checkOrderItem(item, len, inventory, list_order_id, token);

      }

      // after update all order item of file, set status = completed
      UploadExel.findByIdAndUpdate(list_order_id, { $set: { "status": "Completed" } }, function (err, callback) {
         return new Promise( (resolve, reject) => {
            if (err || !callback) return resolve('update file status fail');
            let notifyHeader = {
               headers: {
                  "Authorization" :  "Bearer SYSTEM-619d5252bd915410515d5fdf981b5964",
                  "Content-Type" : "application/json"
               }
            };

            let date = new Date();

            let notifyObject = {
               "id":"#",
               "app":"vtp",
               "badge":1,
               "title":"Thông báo",
               "content":"Hoàn thành check tất cả các đơn hàng trong file " + fileName + " tải lên lúc " + formatDateTimeNotify(new Date(uploadTime)),
               "icon":"https://viettelpost.vn/img/thongbao/i_donhangthanhcong.png",
               "time": date.getTime(),
               "owner": inventory.CUS_ID.toString(),
               "status":0,
               "type":5,
               "ref": "excel-" + list_order_id
            };

            axios.post(NotifyUrl, notifyObject, notifyHeader)
            .then( success => {
               console.log('notify success');
               resolve('notify success');
            })
            .catch( err => {
               console.log(err);
               console.log('notify error');
               reject('notify error');
            })
            return resolve('check order in file complete')
         })
      })


      // let prommisesItem = list.map(checkOrderItem, {inventory, list_order_id});
      // await Promise.all(prommisesItem);
   } catch (e) {
      console.log(e);
      console.log('Can not connect to server or API error');
   } finally {
      console.log(`End check list order ${list_order_id}`);
   }

}

// check order item from NLP -> get price -> insert
function checkOrderItem(item, len, inventory, list_order_id, token) {
   if (item.status != "Change" && item.status != "New") {
      return new Promise( resolve => {
         resolve('ok');
      });
   }

   else return new Promise( (resolve, reject) => {
      console.log(`${item.index}. ${item.status}`);
      let NLPResponse = {};
      let NLPOrder = {};
      let order_insert = {};
      // start check order item of file
      try {
         axios.post(NLP_URL, { addresss: [item.order.DIACHI_KHNHAN] })
         .then(  checkNLP => {
            if (!checkNLP) {
               return resolve('exit');
            }
            // console.log(checkNLP.data);
            NLPResponse = checkNLP.data[0]
            if (NLPResponse.province.code == 0 && NLPResponse.commune.code == 0 && NLPResponse.district.code == 0) {
               console.log('NLP Error');
               // NLP error
               UploadExel.findOneAndUpdate(
                  { "_id": list_order_id, "content.index" : item.index  },
                  { $set: { "content.$.status" : "NLPError"  } },
                  function (err, cb) {
                     return resolve('ok')
                  }
               )
            } else {
               console.log('NLP Success');
               // NLP success and validate price
               NLPOrder = {
                  "RECEIVER_WARD": NLPResponse.commune.code,
                  "RECEIVER_DISTRICT": NLPResponse.district.code,
                  "RECEIVER_PROVINCE": NLPResponse.province.code
               };

               let order_info = {
                  "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
                  "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
                  "RECEIVER_PROVINCE": NLPResponse.province.code,
                  "RECEIVER_DISTRICT": NLPResponse.district.code,
                  "PRODUCT_TYPE": "HH",
                  "ORDER_SERVICE": item.order.DICH_VU.split('-')[0].trim(),
                  "ORDER_SERVICE_ADD": item.order.DICH_VU_KHAC,
                  "PRODUCT_WEIGHT": item.order.TRONG_LUONG_GRAM,
                  "PRODUCT_PRICE": item.order.TRI_GIA_HANG,
                  "MONEY_COLLECTION": item.order.TIEN_THU_HO,
                  "PRODUCT_QUANTITY": 1,
                  "NATIONAL_TYPE": 1
               };
               return axios.post(GetOrderPriceUrl, order_info);
            }
         })
         .then( getPriceResponse => {

            if (!getPriceResponse) {
               return resolve('exit');
            }

            console.log(getPriceResponse.data);

            if (getPriceResponse.error) {
               // order is not validate and update status to "validate_failed"
               console.log('validate fail');
               UploadExel.findOneAndUpdate(
                  { "_id": list_order_id, "content.index" : item.index  },
                  { $set: { "content.$.status" : "ValidateEror", "content.$.NLP": NLPOrder } },
                  function (err, cb) {
                     return resolve('ok');
                  }
               )
            } else {
               console.log('validate success');
               //order validate and continue insert order
               let order = item.order;
               //get order ORDER_PAYMENT
               let order_payment = 0;
               if (order.NGUOI_NHAN_TRA_CUOC.startsWith('1')) {
                  if (order.TIEN_THU_HO == 0) {
                     order_payment = 4;
                  } else {
                     order_payment = 2;
                  }
               } else if (order.TIEN_THU_HO == 0) {
                  order_payment = 1;
               } else {
                  order_payment = 3;
               }

               console.log('order_payment : ', order_payment);

               order_insert = {
                  "ORDER_NUMBER": order.MA_DON_HANG ? order.MA_DON_HANG : "",
                  "GROUPADDRESS_ID": inventory.GROUPADDRESS_ID,
                  "CUS_ID": inventory.CUS_ID,
                  "DELIVERY_DATE": formatDateTime(new Date()),
                  "SENDER_FULLNAME": inventory.NAME,
                  "SENDER_ADDRESS": inventory.ADDRESS,
                  "SENDER_PHONE": inventory.PHONE,
                  "SENDER_EMAIL": "c.phamquang@e-comservice.com",
                  "SENDER_WARD": Number(inventory.WARDS_ID),
                  "SENDER_DISTRICT": Number(inventory.DISTRICT_ID),
                  "SENDER_PROVINCE": Number(inventory.PROVINCE_ID),
                  "SENDER_LATITUDE": 0,
                  "SENDER_LONGITUDE": 0,
                  "RECEIVER_FULLNAME": order.TEN_NGUOI_NHAN,
                  "RECEIVER_ADDRESS": order.DIACHI_KHNHAN,
                  "RECEIVER_PHONE": order.DIEN_THOAI_KHNHAN,
                  "RECEIVER_EMAIL": "",
                  "RECEIVER_WARD": NLPResponse.commune.code,
                  "RECEIVER_DISTRICT": NLPResponse.district.code,
                  "RECEIVER_PROVINCE": NLPResponse.province.code,
                  "RECEIVER_LATITUDE": 0,
                  "RECEIVER_LONGITUDE": 0,
                  "PRODUCT_NAME": order.NOI_DUNG_HANG_HOA,
                  "PRODUCT_DESCRIPTION": "",
                  "PRODUCT_QUANTITY": 1,
                  "PRODUCT_PRICE": order.TRI_GIA_HANG,
                  "PRODUCT_WEIGHT": order.TRONG_LUONG_GRAM,
                  "PRODUCT_TYPE": "HH",
                  "ORDER_PAYMENT": order_payment,
                  "ORDER_SERVICE": order.DICH_VU.split('-')[0].trim(),
                  "ORDER_SERVICE_ADD": order.DICH_VU_KHAC ? order.DICH_VU_KHAC : "",
                  "ORDER_VOUCHER": 0,
                  "ORDER_NOTE": "",
                  "MONEY_COLLECTION": order.TIEN_THU_HO,
                  "MONEY_TOTALFEE": 0,
                  "MONEY_FEECOD": 0,
                  "MONEY_FEEVAS": 0,
                  "MONEY_FEEINSURRANCE": 0,
                  "MONEY_FEE": 0,
                  "MONEY_FEEOTHER": 0,
                  "MONEY_TOTALVAT": 0,
                  "MONEY_TOTAL": 0
               }

               console.log(order_insert);
               // console.log('token', token);
               return axios.post(InsertOrderUrl, order_insert, { headers: { "Token":  token} } )

            }
         })
         .then( insertResponse => {
            if (!insertResponse) {
               return resolve('exit');
            }
            console.log(insertResponse.data);
            // console.log(insertResponse.data.data.ORDER_NUMBER);
            if (insertResponse.data.status == 200 && !insertResponse.data.error ) {
               console.log('insert order success');
               // insert order success
               UploadExel.findOneAndUpdate(
                  { "_id": list_order_id, "content.index" : item.index  },
                  { $set: {
                     "content.$.status" : "Completed",
                     "content.$.order.MA_DON_HANG" : insertResponse.data.data.ORDER_NUMBER,
                     "content.$.NLP" : NLPOrder
                  } },
                  function (err, cb) {
                     return resolve('ok');
                  }
               )
            } else {
               console.log('insert order error');
               //insert order fail
               UploadExel.findOneAndUpdate(
                  { "_id": list_order_id, "content.index" : item.index  },
                  { $set: { "content.$.status" : "CreateOrderError", "content.$.NLP" : NLPOrder } },
                  function (err, cb) {
                     return resolve('ok');
                  }
               )
            }

         })
         .catch( err => {
            console.log('err', err);
            reject('exit');
         })
      } catch (e) {
         console.log('errrrr', e);
      } finally {

      }

   })
}

router.get('/ronalkean', function(req, res){
    res.redirect('/xlsx/multiple-order-export/multi-order-export-1534603722078.xlsx');
})

router.get('/info', async function(req, res) {
   let list_cus_id = [
        "1702545",
        "1446107",
        "1486445",
        "722",
        "1464987",
        "1706454",
        "1709259",
        "1709243",
        "1710799",
        "1364830",
        "1445800",
        "1710795",
        "1712017",
        "1552463",
        "1448374",
        "1443214",
        "1510563"
    ];
   let promises = list_cus_id.map( function(cus_id){
      console.log(cus_id);
      return new Promise((resolve, reject) => {
         UploadExel.find( { cusId : cus_id }, { inventory: 1 }).exec( (err, response) => {
            // console.log(err);
            // console.log(response);
            resolve(response[0]);
         })
      });
   })

   let list = await Promise.all(promises);

   res.send({ data: list });

});


module.exports = router;
