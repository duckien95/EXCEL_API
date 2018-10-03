const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const xlsx = require('node-xlsx');
const jwt = require('jsonwebtoken');
const schedule = require('node-schedule');

const verify = require('../auth/VerifyToken');
const ExcelWeb = require('../dao/excel-web');
const ExcelWebRepository = require('../repositories/excel-web-repository');


const DailyReportExcel = require('../dao/daily-report-excel');
const FileManagement = require('../dao/file-management');
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

const baseExcelFolderPath = '../VTPCMS/public/web-xlsx/';
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
        ExcelWeb.find({ uploadTime : { $gt: nextDay.getTime() - 86400000, $lt: nextDay.getTime() }, cusId: { $nin: listTester }}, { _id: 1, cusId: 1 }, function(err, dailyReports){
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
        ExcelWeb.aggregate([
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
   ExcelWebRepository.checkOrderCronJob();
});

router.get('/status/:file_id', function(req, res){
    const { file_id } = req.params;
    if (file_id == undefined) {
        return res.status(400).send({ status: 400, error: true, message: "file_id is undefined", data: null });
    }
    ExcelWeb.findOne({ _id: file_id },{ content: 0, token: 0, header: 0, inventory: 0 }, function(err, file) {
        if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
        if(!file) return res.status(200).send({ status: 200, error: true, message: `file_id ${file_id} not exists`, data: null });
        return res.status(200).send({ status: 200, error: false, message: "success", data: file });
    });
});

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
      const workSheetsFromBuffer = xlsx.parse(path.join(__root, 'public/web-xlsx/' + concatPath + req.file.filename));
      // Parse a file
      const workSheetsFromFile = xlsx.parse(path.join(__root, 'public/web-xlsx/' + concatPath + req.file.filename));

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
                     row_data[standardHeader[k]] = sheet[j][k] ? ( '0' + sheet[j][k] ) : "";
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

         ExcelWeb.create(exelObject, function (err, cb) {
            if(err) return res.status(500).send({ status: 500, error: true, message: "Can not upload file exel", data: null });
            return res.status(200).send({status: 200, error: false, message: "Upload file exel success", file_id: cb[0]._id});
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
      return res.status(400).send({ status:400, message: "File is not choosen", error: true });
   }
})




// router.post('/create', function (req, res) {
//    ExcelWeb.create(req.body , function (err, cb) {
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

   ExcelWeb.findOne({ "_id": file_id }).exec( function(err, data) {
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
      fs.writeFile(`public/web-xlsx/${filename}`, buffer, function (err) {
         if (err) {
            //if write file error
            return res.status(200).send({ status: 200, error: true, message: `write file error, try it again`, data: null });
         }
         // else return res.render('index', {link: `/xlsx/${filename}`, name: filename});
         else {
            FileManagement.create({
                create_time: new Date(),
                path: `/web-xlsx/${filename}`
            }, function (err, cb) {

                if (err) {
                    return res.status(500).send({ status: 500, error: true, message: "Can not connect to server", data: null });
                }
                let buff = new Buffer(`/web-xlsx/${filename}`);
                return res.status(200).send({
                    status: 200,
                    error: false,
                    message: "success",
                    download_url: '/download/' + buff.toString('base64'),
                    data: { download_url: '/download/' + buff.toString('base64') }
                });
            })
         }
         // return res.redirect(`/web-xlsx/${filename}`);
         // else return res.render('index');
      });
      // res.send(buffer);
   })
});

router.get('/list_all', function(req, res){
   ExcelWeb.find({}, function(err, list_order){
        if (err) {
            console.log('error', err);
            return res.status(500).send({ status: 500, error: true, message: err })
        }

        let excelData = [];
        console.log(list_order.length);

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
           'MA_DON_HANG',
           'ORDER_NUMBER'
       ];

       excelData.push(header);
        
        for (let i in list_order ){

            for(let j in list_order[i].content) {
                let row = list_order[i].content[j].order;
                // row = row.order;
                // console.log(row);
                if (row && row.ORDER_NUMBER != '') {
                    let rowExcel = [];
                    for (let j = 0; j < header.length; j++) {
                        rowExcel.push(row[header[j]]);
                    }

                    // add all row to excel file
                    excelData.push(rowExcel);
                }

            }
        }

       let date = new Date();
       let name = 'list-all-' + date.getTime();
       let filename = `${name}.xlsx`;
       let buffer = xlsx.build([{name: "List Order", data: excelData }]); // Returns a buffer
       fs.writeFile(`public/web-xlsx/${filename}`, buffer, function (err) {
          if (err) {
              return res.status(500).send({ status: 500, error: true, message: err })
          }

          else {
              let buff = new Buffer(`/web-xlsx/${filename}`);
              return res.status(200).send({
                  status: 200,
                  error: false,
                  message: "success",
                  download_url: '/download/' + buff.toString('base64'),
                  data: { download_url: '/download/' + buff.toString('base64') }
              });
          }
       });
   });
});

// router.get('/download/:code', function(req, res) {
//     console.log(req.params.code);
//     let buff = new Buffer(req.params.code, 'base64');
//     console.log(buff.toString('ascii'));
//     res.redirect(buff.toString('ascii'));
// });

router.post('/get_all', async function (req, res) {
   // req.body = { cus_id: '111111111111111111' }
   ExcelWeb.find().exec(function (err, cb) {
      if(err) return res.status(500).send({ status: 500, error: true, message: "Can not connect to server or query error", data: null });
      res.status(200).send({ status: 200, error: false, message: "success", data: cb});
   })
})

router.post('/get_by_cus_id', function (req, res) {
   // req.body = { cus_id: '111111111111111111' }
   if(req.body.cus_id == undefined) {
      return res.status(400).send({ status: 400, error: true, message: "CusId is undefined", data: null });
   }
   ExcelWeb.find({ cusId: req.body.cus_id }).exec(function (err, cb) {
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


      // check if file_id exists and change status of order item to "Change" then run
      let order_item = {};
      let updateDataOnMongo = await new Promise( (resolve, reject) => {
         ExcelWeb.findOneAndUpdate(
            { "_id": file_id, "content.index" : index },
            { $set: {
               "content.$.status": "Change",
               "content.$.order.DICH_VU_KHAC": order.ORDER_SERVICE_ADD,
               "content.$.order.DICH_VU": order.ORDER_SERVICE,
               "content.$.order.TEN_NGUOI_NHAN": order.RECEIVER_FULLNAME,
               "content.$.order.DIACHI_KHNHAN": order.RECEIVER_ADDRESS,
               "content.$.order.DIEN_THOAI_KHNHAN": order.RECEIVER_PHONE,
               "content.$.order.NOI_DUNG_HANG_HOA": order.PRODUCT_NAME,
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
             console.log(err);
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
            "ORDER_SERVICE": order.ORDER_SERVICE,
            "ORDER_SERVICE_ADD": order.ORDER_SERVICE_ADD,
            "PRODUCT_WEIGHT": order.PRODUCT_WEIGHT,
            "PRODUCT_PRICE": order.PRODUCT_PRICE,
            "MONEY_COLLECTION": order.MONEY_COLLECTION,
            "PRODUCT_QUANTITY": order.PRODUCT_QUANTITY,
            "NATIONAL_TYPE": order.NATIONAL_TYPE
         }
         axios.post(GetOrderPriceUrl, order_info)
         .then( response => {
            // console.log("1365. ", response.data);
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
         ExcelWeb.findOneAndUpdate(
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
         ExcelWeb.findOneAndUpdate(
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
         ExcelWeb.findOne({ _id: file_id }).exec()
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
         ExcelWeb.findOneAndUpdate(
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
         ExcelWeb.findOneAndUpdate(
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
         ExcelWeb.findOne({ _id: file_id }).exec()
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
               ExcelWeb.findOneAndUpdate(
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
               ExcelWeb.findOneAndUpdate(
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
            ExcelWeb.findOne({ _id: file_id }).exec()
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

        let submitResponse = await ExcelWebRepository.submitAllOrder(list_order, inventory, orderDataResponse, file_id);

        if (submitResponse.error) {
            return res.status(500).send({status: 500, message: 'Đã có lỗi xảy ra khi tạo đơn, vui lòng thử lại', error: true, data: null });
        } else {
            return res.status(200).send({
                status: 200,
                message: 'Tạo tất cả các đơn thành công',
                error: false,
                data: {
                    orders: submitResponse.orders,
                    total_success: submitResponse.total_success,
                    total_error: submitResponse.total_error
                }
            });
        }

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

   console.log(file_id);

   ExcelWeb.findById( file_id, function(err, history) {
      // try {
         if (err) return res.status(500).send({status: 500, message: 'Can not connect to server', error: true, data: null });
         if (!history) return res.status(200).send({status: 200, message: 'File not found', error: true, data: null });
         let list_order_detail = [], list_receiver_address = [];
         let minIndex = page_size * (page_index - 1);
         let maxIndex =  minIndex + page_size;
         let numberOrderMatchStatus = 0;

         if (list_status.length == 0) {
            list_status = ["New", "Error", "Processing", "NLPError", "ValidateError", "ValidateSuccess", "CreateOrderError", "Completed"];
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
                        "MONEY_COLLECTION": convertToNumber(item.order.TIEN_THU_HO),
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

   ExcelWeb.find({ cusId: cus_id }).sort({uploadTime: -1}).exec(function(err, history) {
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
        fs.writeFile(`public/web-xlsx/multiple-order-export/${filename}`, buffer, function (err) {
           if (err) {
              //if write file error
              return res.status(200).send({ status: 200, error: true, message: `write file error, try it again`, data: null });
           }

           else {

               let filePath = `/web-xlsx/multiple-order-export/${filename}`;
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
        fs.writeFile(`public/web-xlsx/report/${filename}`, buffer, function (err) {
           if (err) {
              //if write file error
              return res.status(200).send({ status: 200, error: true, message: `write file error, try it again`, data: null });
           }

           else {
               let filePath = `/web-xlsx/report/${filename}`;
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
    });
});

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
         ExcelWeb.find( { cusId : cus_id }, { inventory: 1 }).exec( (err, response) => {
            // console.log(err);
            // console.log(response);
            resolve(response[0]);
         })
      });
   })

   let list = await Promise.all(promises);

   res.send({ data: list });

});

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
};

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
};

function convertToNumber(str) {
   return str ? Number(str) : 0;
};


module.exports = router;
