'use strict';

const ExcelWeb = require("../dao/excel-web");
const axios = require('axios');
const verify = require('../auth/VerifyToken');

const NLP_URL  = "http://address-address.oc.viettelpost.vn/parser";
const GetOrderPriceUrl = "https://api.viettelpost.vn/api/tmdt/getPrice";
const GetOrderDetailUrl = "https://api.viettelpost.vn/api/setting/getOrderDetail?OrderNumber=";
const InsertOrderUrl = "https://api.viettelpost.vn/api/tmdt/InsertOrder";
const NotifyUrl = "https://io.viettelpost.vn/notification/v1.0/notification";

class ExcelWebRepository {
    static checkOrderCronJob() {
        let responseObject = [];
        // console.log(req.headers.token);
        let token = "";
        let ListFileChanged = [];

        ExcelWeb.find({ status: { $in: ["Change",  "Uploaded"] }}).exec()
        .then( listFile => {
            if (listFile) {
                ListFileChanged = listFile;
                return ExcelWeb.updateMany({ status: { $in: ["Change",  "Uploaded"] }}, { $set: { status: "Processing" } } ).exec()
                // return ExcelWeb.find({ status: { $in: ["Change",  "Uploaded"] }} ).exec()
            }
            //if no file changed
            return res.status(200).send({ status: 200, error: true, message: "no file changed", data: null });
        })
        .then( updateResult => {
            // console.log(updateResult);
            if (updateResult) {
                return ExcelWeb.find({ status: "Processing" }).exec();
            }

            //if update file status fail
            return res.status(200).send({ status: 200, error: true, message: "update file status fail", data: null });
        })
        .then( processingFile => {
            if (processingFile) {
                console.log("Number of excel file have status New/Change : ", ListFileChanged.length);
                checkOrderToInsert(ListFileChanged);
                // return res.status(200).send({ status: 200, error: true, message: "success", data: processingFile });
            }

            //if has no processing file
            // return res.status(200).send({ status: 200, error: true, message: "no processing file", data: null });
        })
        .catch( err => {
            console.log('Error on checkOrderCronJob function');
            // return res.status(500).send({ status: 500, error: true, message: "error", data: null, log: err });
        });
    };

    static async submitAllOrder(list_order, inventory, orderDataResponse, file_id){
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
                        // console.log(orderNumber);
                        return resolve({  error: false, order_number:  response.data.data.ORDER_NUMBER, index: item.index});
                    }
                    resolve({ error: true, message: response.data.message, index: item.index})
                })
                .catch( err => {
                    console.log(err);
                    reject({ error: true, message: 'Can not connect to server', index: item.index})
                });
            });
        });

        let createOrderResponse = await Promise.all(listPromise);

        let numberCreateError = 0, numberCreateSuccess = 0;

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
                        if (resp) {
                           numberCreateError += 1;
                           return resolve('success');
                        }
                        reject('error');
                    })
                    .catch( err => {
                        reject('error');
                    });
                }

                else {
                    // if insert order success
                    ExcelWeb.findOneAndUpdate(
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
        });

        let updateStatusInsertOrderResponse =  await Promise.all(updateStatusInsertOrderPromise);
        console.log(updateStatusInsertOrderResponse);
        if (updateStatusInsertOrderResponse.includes('error')) {
            return { error: true }
        } return {
            error: false,
            orders: createOrderResponse,
            total_success: numberCreateSuccess,
            total_error: numberCreateError
        }
    };

}


const formatDateTime = (date) => {
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

const checkOrderToInsert = async (array) => {
    console.log('Check Order To Insert In Web');
    // check each file one by one
    try {
        for (let item in array) {
            console.log('<----------------------------------EXCEL ON WEB--------------------------------------------->');
            console.log(item + '. ' + array[item]._id);
            await checkListAllOrder(array[item], array[item].token);
            console.log('<----------------------------------EXCEL ON WEB--------------------------------------------->');
        }
    } catch (e) {
        console.log(e);
        console.log('Error on checkOrderToInsert function');
    } finally {
        console.log('Done check all file !!!!!!!!!!!');
    }

}

const checkListAllOrder = async (list, token) => {
    console.log('checkListOrderTest');
    let list_order_id = list._id,
        fileName = list.originalName,
        uploadTime = list.uploadTime,
        list_status = verify.list_status,
        list_status_required = verify.list_status_web_require;
    try {
        let inventory = list.inventory,
        list_order = list.content;

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

        let listProvince = await getAllProvinceInVN();
        let listDistrict =  await getAllDistrictInVN();
        if (listProvince.includes('error') || listDistrict.includes('error')) {
            return Promise.reject('exit');
        }

        // console.log('587', NLPResponse);
        // console.log(NLPResponse[0].province.code);
        let listIndexNLPError = [], listNLPSuccess = [], ListNLPError = [];
        for (let i = 0; i < NLPResponse.length; i++) {
            // console.log(list_order[i]);
             // console.log(NLPResponse[i].province.code);
            list_order[i].NLP.RECEIVER_PROVINCE = NLPResponse[i].province.code;
            list_order[i].NLP.RECEIVER_DISTRICT = NLPResponse[i].district.code;
            list_order[i].NLP.RECEIVER_WARD = NLPResponse[i].commune.code;

            if (NLPResponse[i].province.code == 0 && NLPResponse[i].district.code == 0 && NLPResponse[i].commune.code == 0) {
                // insert index to listIndexNLPError
                let receiver_province = list_order[i].order.TINH_DEN.split('_');
                let receiver_district = list_order[i].order.QUAN_DEN.split('-');
                let provinceNLP = {}, districtNLP = {};
                if(receiver_province.length && receiver_district.length) {
                    provinceNLP = listProvince.filter( item => item.PROVINCE_CODE == receiver_province[receiver_province.length -1]);
                    if (provinceNLP.length) {
                        provinceNLP = provinceNLP[0];
                        if (provinceNLP.PROVINCE_ID) {
                            districtNLP =  listDistrict.filter( item => {
                                if (item.PROVINCE_ID == provinceNLP.PROVINCE_ID && item.DISTRICT_NAME.includes(receiver_district[0])) {
                                    return true;
                                }
                                return false;
                            });
                            if (districtNLP.length) {
                                districtNLP = districtNLP[0];
                            }

                        }
                    }
                }

                if (provinceNLP.PROVINCE_ID && districtNLP.DISTRICT_ID) {
                    list_order[i].NLP.RECEIVER_PROVINCE  = provinceNLP.PROVINCE_ID;
                    list_order[i].NLP.RECEIVER_DISTRICT  = districtNLP.DISTRICT_ID;
                    listNLPSuccess.push(list_order[i]);
                    continue;
                } else {
                    listIndexNLPError.push(list_order[i].index)
                }


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
        let updateStatusValidateSuccessRes = await updateStatusValidateSuccess(listValidateSuccess, list._id);
        if (updateStatusValidateSuccessRes.includes('error')) {
            // call noti API
            console.log('Update status validate success on mongodb error');
            return Promise.reject('exit');
        }

        console.log("listIndexInfoInvalid ", listIndexInfoInvalid);

        console.log('List index ValidateError', listIndexValidateError);

        console.log('List index ValidateSuccess', listIndexValidateSuccess);

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
            ExcelWeb.findOneAndUpdate({ _id: list._id }, { $set: { status: "Completed" } }).exec()
            .then( success => {
                resolve('success')
            })
            .catch( err =>{
                reject('error')
            });
        });

        if ( updateStatusComplete == "error") {
            return Promise.reject('exit');
        }

      console.log('Done promise all !!!!!');

    } catch (e) {
        console.log(e);
        console.log('Can not connect to server or API error');
    } finally {
        console.log(`End check list order ${list_order_id}`);
    }

};

const checkNLPMultipleOrder = (listReceiverAddress) => {
    return new Promise ((resolve, reject) => {
    // console.log(item);
        axios.post(NLP_URL, { addresss: listReceiverAddress })
        .then( response => {
            if (response && response.data) {
                return resolve(response.data);
            }
            resolve('error');
        })
        .catch( err => {
            // console.log(err);
            resolve('error');
        });
    });
}

const getPriceMultipleOrder = (list_item, inventory) => {
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
            };

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
            });
        });
    });

    return Promise.all(listGetPricePromise);
};

const updateStatusInsertError = (listIndexInsertError, fileId) => {
    if (listIndexInsertError.length) {
        let insertErrorPromise =  listIndexInsertError.map( function(i) {
            new Promise( (resolve, reject) => {

                ExcelWeb.findOneAndUpdate(
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
        });
    }
};

const updateStatusInsertSuccess = (listInsertSuccess, fileId) => {
    if (listInsertSuccess.length) {
        let insertSuccessPromise =  listInsertSuccess.map( function(item) {
            new Promise( (resolve, reject) => {

                ExcelWeb.findOneAndUpdate(
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
        });
    }
};

const updateInvalidMessageStatus =  async (list_check_info, id) => {
   const listPromise = list_check_info.map( function(order) {
        return new Promise( (resolve, reject) => {

            ExcelWeb.findOneAndUpdate(
               { "_id": id, "content.index" : order.index  },
               { $addToSet: { "content.$.message":  { $each : order.message } } }
            ).exec()
            .then( (checkInfoRes) => {
               if ( checkInfoRes) {;
                  resolve('success');
               } else {
                  // update message error
                  reject('error')
               }
            })
            .catch( err => {
               console.log('error in updateInvalidMessageStatus');
               reject('error')
            });

        });
   });

   return Promise.all(listPromise);
};

const updateNLPStatusMongo = (list_order, id) => {
    const listPromise = list_order.map( function(order) {
        return new Promise( (resolve, reject) => {
            ExcelWeb.findOneAndUpdate(
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
                   resolve('success');
                } else {
                   // update NLP error
                   reject('error')
                   // reject(res);
                }
            })
            .catch( err => {
                console.log('error in updateNLPStatusMongo');
                reject('error')
            });
        });
    });

    return Promise.all(listPromise);
};

const updateStatusNLPError = (listIndexNLPError, fileId) =>  {
    if (listIndexNLPError.length) {
        let NLPErrorPromise =  listIndexNLPError.map( function(i) {
            return new Promise( (resolve, reject) => {
                ExcelWeb.findOneAndUpdate(
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
                      // update NLP success
                      resolve('success');
                   } else {
                      // update NLP error
                      reject('error')
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
        });
    }
};

const updateStatusValidateError = (listIndexValidateError, fileId) =>  {
   if (listIndexValidateError.length) {
        let validateErrorPromise = listIndexValidateError.map( function(i) {
            new Promise( (resolve, reject) => {
                ExcelWeb.findOneAndUpdate(
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
        });

        return Promise.all(validateErrorPromise);
    }
    else {
        return new Promise( resolve => {
            resolve('success');
        });
    }
};

const updateStatusValidateSuccess = (listValidateSuccess, fileId) => {
   if (listValidateSuccess.length) {
        let validateSuccessPromise = listValidateSuccess.map( function(item) {
        let lenOfListFee = item.price.length;
        let fee_other = 0;
        for (let i = 2; i < lenOfListFee - 2; i++) {
            fee_other +=  Number(item.price[i].PRICE);
        }
            new Promise( (resolve, reject) => {
                ExcelWeb.findOneAndUpdate(
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
        });

         return Promise.all(validateSuccessPromise);
    }
    else {
        return new Promise( resolve => {
            resolve('success');
        });
    }
};

const updateCheckInfoStatusMongo = (list_check_info, id) => {
    const listPromise = list_check_info.map( function(order) {
        return new Promise( (resolve, reject) => {
            // console.log(order.index);
            ExcelWeb.findOneAndUpdate(
               { "_id": id, "content.index": order.index },
               {
                   "$set": { "content.$.status": "Error" },
                   "$push": { "content.$.message":  { $each : order.message } }
                }
            ).exec()
            .then( (checkInfoRes) => {
                if ( checkInfoRes) {
                    // update info success
                    resolve('success');
                } else {
                    // update info error
                    reject('error')
                    // reject(res);
                }
            })
            .catch( err => {
                console.log('error in updateCheckInfoStatusMongo');
                reject('error')
            });
        });
    });

   return Promise.all(listPromise);
};

const  insertMultipleOrder = (list_item, inventory, token) => {
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
};

const getListDistrict = async() => {
    return new Promise((resolve, reject) => {
        axios.get('https://api.viettelpost.vn/api/setting/listalldistrict')
        .then( success => {
            if (success.data) {
                console.log(success.data);
                return resolve(success.data);
            }

            return resolve('error');
        }).catch( err => {
            console.log(err);
            reject('error');
        });
    });
};

const getAllDistrictInVN = () => {
    return new Promise((resolve, reject) => {
        axios.get('https://api.viettelpost.vn/api/setting/listalldistrict')
        .then( success => {
            if (success.data) {
                // console.log(success.data);
                return resolve(success.data);
            }

            return resolve('error');
        }).catch( err => {
            console.log(err);
            reject('error');
        });
    });
};

const getAllProvinceInVN = () => {
    return new Promise((resolve, reject) => {
        axios.get('https://api.viettelpost.vn/api/setting/listallprovince')
        .then( success => {
            if (success.data) {
                // console.log(success.data);
                return resolve(success.data);
            }

            return resolve('error');
        }).catch( err => {
            console.log(err);
            reject('error');
        });
    });
};

module.exports = ExcelWebRepository;
