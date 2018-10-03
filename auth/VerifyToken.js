var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('../config'); // get our config file



module.exports = {
   verifyAppToken: function (req, res, next) {
      // check header or url parameters or post parameters for token
      var token = req.headers['token'];
      if (!token)
         return res.status(403).send({ auth: false, message: 'No token provided.' });
      // verifies secret and checks exp
      jwt.verify(token, config.secret, function(err, decoded) {
         if (err)
            return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
         // console.log(decoded)
         // if everything is good, save to request for use in other routes
         req.clientAppId = decoded.id;
         // req.clientAppId = decoded.userId;
         next();
      });
   },

   verifyUserToken: function (req, res, next) {
      // check header or url parameters or post parameters for token
      var token = req.headers['token'];
      if (!token)
         return res.status(403).send({ auth: false, message: 'No token provided.' });
      // verifies secret and checks exp
      jwt.verify(token, config.secret, function(err, decoded) {
         if (err)
            return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
         console.log(decoded)
         // if everything is good, save to request for use in other routes
         req.clientAppId = decoded.userId;
         next();
      });
   },

   IsNotEmptyOrUndefined: function(string) {
      if( string != undefined && string.trim() != '') return true;
      return false
   },

   IsNotNegativeOrUndefined: function(num) {
      if( num != undefined && num > 0) return true;
      return false
   },

   checkUndefined: function(string) {
      if( string != undefined ) return string;
      return '';
   },

   list_status: {
      "DIACHI_KHNHAN": "địa chỉ người nhận",
      "DIEN_THOAI_KHNHAN": "điện thoại người nhận",
      "TEN_NGUOI_NHAN": "tên người nhận",
      "TINH_DEN": "tỉnh đến",
      "QUAN_DEN": "quận đến",
      "NOI_DUNG_HANG_HOA": "tên hàng hóa",
      "NGUOI_NHAN_TRA_CUOC": "người trả cước",
      "TRONG_LUONG_GRAM": "trọng lượng",
      "DICH_VU": "dịch vụ"
   },

   list_status_require: [
      "DIACHI_KHNHAN",
      "DIEN_THOAI_KHNHAN",
      "TEN_NGUOI_NHAN",
      // "TINH_DEN",
      // "QUAN_DEN",
      "NOI_DUNG_HANG_HOA",
      "NGUOI_NHAN_TRA_CUOC",
      "TRONG_LUONG_GRAM",
      "DICH_VU"
   ],
   list_status_web_require: [
      "DIACHI_KHNHAN",
      "DIEN_THOAI_KHNHAN",
      "TEN_NGUOI_NHAN",
      "TINH_DEN",
      "QUAN_DEN",
      "NOI_DUNG_HANG_HOA",
      "NGUOI_NHAN_TRA_CUOC",
      "TRONG_LUONG_GRAM",
      "DICH_VU"
   ],

   formatMessageError: function(str) {
      return "Thiếu " + str;
   },

   IsPhoneNumber: function(phone) {
      // let regex  = new RegExp("0?(9[0-9]|1[5|2|6][0-9]|18[6|8]|08[0-9]|03[0-9]|07[0|6|7|8|9]|0[2|4|5][0-9])+([0-9]{7})");
      let regex  = new RegExp("(05|03|04|07|08|01[2689]|09|021[23456]|023[23456789]|020[3456789]|022[123456789]|029[01234679]|025[123456789]|026[01239]|027[01234567]|024|028)+([0-9]{8})");
      if(phone.toString().search(regex) == 0) return true;
      return false;
   }


}
