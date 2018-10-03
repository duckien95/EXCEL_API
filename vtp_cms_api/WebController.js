var express = require('express');
var Joi = require('joi');
var router = express.Router();
var bodyParser = require('body-parser');
var multer = require('multer');
var ValidateOrderStatus = require('../validation/order-status');
var VerifyToken = require('../auth/VerifyToken');
var FbAssignSalerToCustomer = require('../models/fb_assign_saler_to_customer');
var FbConversationDetail = require('../models/fb_conv_detail');
var FbUserConfig = require('../models/fb_user_config');
// const TestBulk = require('../models/test');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());


var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../VTPCMS/public/images')
  },
  filename: function (req, file, cb) {
     console.log('file', file);
    cb(null, Date.now() + '.' + file.mimetype.split('/')[1])
  }
});

var mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../VTPCMS/public/audios')
  },
  filename: function (req, file, cb) {
     console.log('file', file);
    cb(null, Date.now() + '.' + file.mimetype.split('/')[1])
  }
});

var exelStorage = multer.diskStorage({
   destination: function (req, file, cb) {
      cb(null, '../VTPCMS/public/xlsx')
   },
   filename: function (req, file, cb) {
      cb(null, Date.now() + '.' + file.originalname.split('.').slice(-1)[0])
   }
});

const upload = multer({ storage: storage });
const mediaUpoad = multer({ storage: mediaStorage });
const exelUpoad = multer({ storage: exelStorage });

var Services = require('../dao/services');


/**
 * Configure JWT
 */
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var bcrypt = require('bcryptjs');
var config = require('../config'); // get config file

//Services

router.get('/insert_bulk', function(req, res){
    let bulkData = [];
    let obj = {
        _id: '1_2_3',
        page_id: 2,
        channel_id: 4
    };

    let obj_1 = {
        _id: '4_5_6',
        page_id: 4,
        channel_id: 6
    };
    // {
    //   insertOne: {
    //     document: {
    //       name: 'Eddard Stark',
    //       title: 'Warden of the North'
    //     }
    //   }
    // },

    bulkData.push({
        'updateOne': {
            'filter': { _id: '1_2_3' },
            'update': {
                page_id: 2,
                channel_id: 4
            }
        }
    });

    // bulkData.push({
    //     'insertOne': {'document': obj}
    // });
    //
    // bulkData.push({
    //     'insertOne': {'document': obj_1}
    // });

    // TestBulk.bulkWrite(bulkData, {
    //     'ordered': false
    // }).catch( err => {
    //     console.log('inser bulk fail', err);
    // });

});

router.post('/get-homepage', VerifyToken.verifyAppToken, function(req, res) {
   Services.find({ status: 1, displayOnHome : true }).sort({displayOrder: -1}).exec(function (err, services) {
      if (err) return res.status(500).send('Error on the server.');
      if (!services) return res.status(404).send('No user found.');

      res.status(200).send({ auth: true, data: services });
   });
});


router.post('/get-services-page', VerifyToken.verifyAppToken, function(req, res) {
   res.status(200).send({ auth: true, message: "get-services-page" });
});

router.post('/get-services-by-id', VerifyToken.verifyAppToken, function(req, resp) {
    if (req.body == undefined || Object.keys(req.body).length == 0)
    {
        resp.status(200).send('orderInfo is required!!!');
        return;
    }

    // err === null -> valid
    Joi.validate(JSON.stringify(req.body).toLowerCase(), ValidateOrderStatus, function (err, value) {
        if (err === null) {
            // var topicName = Setting.TOPIC_NAME_ORDER;
            // var kafkaKey = Setting.KAFKA_KEY;
            // var kafkaObject = new Object();
            // kafkaObject.type = APIType.PUSH_ORDER_STATUS;
            // kafkaObject.data = req.body;
            // var kafkaValue = JSON.stringify(kafkaObject).toLowerCase();
            //
            // var rs = new KafkaService();
            // rs.sendMessage([{topic: topicName,
            //     messages: kafkaValue,
            //     key: kafkaKey}], resp);
        }
        else {
            //errors
            err.status = "ValidateError";
            resp.status(200).send(err);
        };
    });
});

//Upload image

router.post('/upload_image', VerifyToken.verifyAppToken, upload.single('file'), function (req, res) {
   if(req.file){
      return res.status(200).send({ message: " Upload image success", error: false, filename: req.file.filename });
   }
   res.status(500).send({ message: "Can not connect to server", error: true });

});

router.post('/upload_media_file', VerifyToken.verifyAppToken, mediaUpoad.single('file'), function (req, res) {
   if(req.file){
      return res.status(200).send({ message: " Upload audio success", error: false, filename: req.file.filename });
   }
   res.status(500).send({ message: "Can not connect to server", error: true });

});

router.post('/upload_exel_file', VerifyToken.verifyAppToken, exelUpoad.single('file'), function (req, res) {
   if(req.file){
      return res.status(200).send({ message: " Upload audio success", error: false, filename: req.file.filename });
   }
   res.status(500).send({ message: "Can not connect to server", error: true });

});

router.get('/insert_assign', function(req, res){
    let date = new Date();
    let assignObject = {
        id: "123_186059228861263_456",
        // id = channelId_pageId_vtsaleUserId
        page_id: "186059228861263",
        channel_id: 123,
        vtsale_user: {
            id: 456,
            name: "kean",
            avatar: "/images/avatar_saler.jpg"
        },
        fb_users: [{
            id: 1738577006191572,
            name: "Phan Quan",
            avatar: "/images/avatar_saler.jpg"
        },{
            id: 1738577006191573,
            name: "Phan Hai",
            avatar: "/images/avatar_saler.jpg"
        },
        {
            id: 1738577006191574,
            name: "Phan Quan",
            avatar: "/images/avatar_saler.jpg"
        }],
        created_time: date.getTime(),
        updated_time: date.getTime()
    }
    FbAssignSalerToCustomer.create(assignObject, function(err, response){
        if (err) {
            console.log(err);
            return res.status(500).send({ status: 500, error: true, message: "Can not connect to server", data: error });
        } else return res.status(200).send({ status: 200, error: false, message: "success", data: response });
    })
});

// router.get('/assign', async function(req, res) {
//
//     let list_conv = [ "186059228861263_235984593868726_1738577006191572", "186059228861263_235984593868726_1738577006191572", "1912942668715957_2297514103592143_123324728574301"];
//     for (let i = 0; i < list_conv.length; i++) {
//         // console.log(response);
//         let conv = await FbConversationDetail.findOne({'_id': list_conv[i]}).exec();
//         console.log(conv.assign_to);
//
//         if(conv.assign_to == undefined){
//             // if not assign to saler
//             let list_fb_user = await FbAssignSalerToCustomer.findOne({'vtsale_user.id': 456}).exec();
//
//             if(list_fb_user && list_fb_user.fb_users.length){
//                 let list_fb_user_id = list_fb_user.fb_users.map( item => {
//                     return item.id.toString();
//                 });
//
//                 console.log(list_fb_user_id);
//                 console.log(list_fb_user.vtsale_user);
//
//                 let assign_saler_response = await FbConversationDetail.updateMany({ 'from.id': { $in: list_fb_user_id }, 'assign_to': { $exists: false} },
//                     { $set : { 'assign_to': list_fb_user.vtsale_user }},
//                     { multiple: true }
//                 ).exec();
//
//                 if (assign_saler_response.ok == 1) {
//                     console.log('update success');
//                 }
//             } else {
//                 console.log('get data from FbAssignSalerToCustomer error');
//             }
//             // console.log(list_fb_user);
//         }
//
//
//         // console.log(assign_saler_response);
//     }
//
//
// });

router.post('/update_user_config', async function (req, res) {
    let { page_id, channel_id, fb_user_id, group } = req.body;
    let vtsale_user_id = 456;
    if(!channel_id) {
        return res.status(400).send({ status: 400, error: true, message: 'channel_id is undefined', data: null });
    }

    if (!page_id) {
        return res.status(400).send({ status: 400, error: true, message: 'page_id is undefined', data: null });
    }

    if(!fb_user_id) {
        return res.status(400).send({ status: 400, error: true, message: 'fb_user_id is undefined', data: null });
    }

    if(group == undefined) {
        return res.status(400).send({ status: 400, error: true, message: 'group is undefined', data: null });
    }

    // check token and vtsale_user_id
    if(!req.headers.token){
    }

    let fb_user_config_row =  await FbUserConfig.findOne(
        { "page_id": page_id, "channel_id": channel_id, "created_by": vtsale_user_id }
    ).exec();

    if (!fb_user_config_row) {
        FbUserConfig.create({
            id: `${page_id}_${channel_id}_${vtsale_user_id}`,// id = pageId_channelId_vtsaleUserId
            page_id: page_id,
            channel_id: channel_id,
            created_by: vtsale_user_id, //vtsale_user_id
            group_conversation: [fb_user_id]
        }, function(err, response){
            if (err) {
                return res.status(500).send({ status: 500, error: true, message: 'Cập nhật nhóm không thành công', data: null });
            }

            return res.status(200).send({ status: 200, error: false, message: 'Cập nhật nhóm thành công', data: null });
        })
    }
    // if fb_user_id exists in database row
    console.log(fb_user_config_row);
    let list_group_conversation = fb_user_config_row.group_conversation;
    let index = -1;
    for (let i = 0; i < list_group_conversation.length; i++) {
        if (list_group_conversation[i] == fb_user_id) {
            console.log('index = ', i);
            index  = i;
        }
    }

    if(group && index < 0) {
        FbUserConfig.findOneAndUpdate(
            { "page_id": page_id, "channel_id": channel_id, "created_by": vtsale_user_id },
            { $push: { 'group_conversation': fb_user_id } },
            function(err, response){
                if (err) {
                    return res.status(500).send({ status: 500, error: true, message: 'Thêm người dùng vào nhóm không thành công', data: null });
                } else return res.status(200).send({ status: 200, error: false, message: 'Thêm người dùng vào nhóm thành công', data: null });
            }
        )
    }

    if(!group && index >= 0){
        FbUserConfig.findOneAndUpdate(
            { "page_id": page_id, "channel_id": channel_id, "created_by": vtsale_user_id },
            { $pull: { 'group_conversation': fb_user_id } },
            function(err, response){
                if (err) {
                    return res.status(500).send({ status: 500, error: true, message: 'Xóa người dùng khỏi nhóm không thành công', data: null });
                } else return res.status(200).send({ status: 200, error: false, message: 'Xóa người dùng khỏi nhóm thành công', data: null });
            }
        )
    }

    else return res.status(200).send({ status: 200, error: false, message: 'Người dùng đã bị xóa hoặc đã tồn tại trong nhóm', data: null });


})

router.post('/insert_user_config', function(req, res){
    FbUserConfig.create({
        id: "123_789_456",
        // id = pageId_channelId_vtsaleUserId
        page_id: 123,
        created_by: 456, //vtsale_user_id
        channel_id: 789,
        group_conversation: [1738577006191575, 1738577006191576, 1738577006191577]
    }, function(err, response){
        if (err) {
            return res.status(500).send({ status: 500, error: true, message: 'error', data: err });
        }
        res.status(200).send({ status: 200, error: false, message: 'success', data: null });

    })
})

module.exports = router;
