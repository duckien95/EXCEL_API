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
var User = require('../dao/user');
var FacebookUser = require('../dao/facebook-user');
const FacebookUserCrawler = require('../dao/facebook-crawler');
var Employee = require('../dao/employee');
var Organization = require('../dao/organization');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

const baseFbFolderPath = '../VTPCMS/public/facebook/';
let nextDay = new Date();
let folderPathOfNextDay = baseFbFolderPath + nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear();
let baseFbFolderPathByDay = folderPathOfNextDay+ '/';

// UPLOAD FILE EXEL
var exelStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        let nextDay = new Date();
        let folderPathOfNextDay = baseFbFolderPath + nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear();
        // console.log(folderPathOfNextDay);
        cb(null, baseFbFolderPath);
    },
    filename: function (req, file, cb) {
        let file_name = Date.now() + '.' + file.originalname.split('.').slice(-1)[0];
        if (req.headers.token) {
            var decoded = jwt.decode(req.headers.token);
            file_name = decoded.UserId + '-' + file_name
        }
      cb(null, file_name)
    }
});

const exelUpoad = multer({ storage: exelStorage });

router.post('/upload-txt-file', exelUpoad.single('file'), async function (req, res){
    if (req.file) {
        return res.status(200).send({ status: 200, error: false, message: "Tải file thành công", filename: req.file.filename });
    }
    return res.status(200).send({ status: 200, error: true, message: "Tải file không thành công", data: null });
});

router.post('/search-by-uid', async function (req, res) {
    let { list_uid, filename } = req.body;
    console.log(req.body);
    if (list_uid != undefined && list_uid.length) {
        list_uid = list_uid.map( item => {
            return item.trim();
        })
    }

    if(filename != undefined && filename != '') {
        // if (req.file.size > MAX_FILE_SIZE) {
        //     // delete file when file size ís large
        //     fs.unlink(baseFbFolderPathByDay + req.file.filename, (err) => {
        //         console.log('successfully deleted ' + baseFbFolderPathByDay + req.file.filename);
        //     });
        //     return res.status(200).send({ status:200, message: "Dung lượng file không được lớn hơn 1MB", error: true });
        // }
        let file_content = await fs.readFileSync(baseFbFolderPath + filename, 'utf-8');
        // console.log(file_content);
        file_content = file_content.split('\n');
        if (file_content.length) {
            list_uid = file_content.filter( item => {
                if (item != '' && item != undefined) {
                    return true;
                }
            });

            list_uid = list_uid.map( item => {
                return item.trim();
            });

        }

        let nextDay = new Date();
        let concatPath = nextDay.getDate() + '-' + (nextDay.getMonth() + 1) + '-' + nextDay.getFullYear() + '/';
        // fs.unlink(baseFbFolderPathByDay + filename, (err) => {
        //     console.log('successfully deleted ' + baseFbFolderPath + filename);
        // });

    }

    // let excelData = [];
    // let txtData = [];
    // let list_users = [];
    //
    // excelData.unshift(["UID", "Phone" ]);


    if (list_uid != undefined && list_uid.length) {
        // const sub_array_size = 20000;
        // let list_sub_array = [];
        // for (let i = 0; i < list_uid.length; i += sub_array_size) {
        //    list_sub_array.push(list_uid.slice(i, i + sub_array_size));
        // }
        //
        // console.log(list_sub_array.length);
        //
        // try {
        //     for (let j = 0; j < list_sub_array.length; j++) {
        //         console.log(j);
        //         let sub_uid_array = list_sub_array[j];
        //
        //         let  users = await getUserFacebook(sub_uid_array);
        //         console.log(users.length);
        //         if(users && users.length){
        //             for ( let index in users) {
        //                 list_users.push(users[index]);
        //                 excelData.push([users[index].user_id, users[index].phone]);
        //                 if (users[index].phone != '') {
        //                     txtData.push(users[index].phone)
        //                 }
        //             }
        //         }
        //
        //     }
        // } catch (e) {
        //     console.log(e);
        //     return res.status(200).send({ status: 200, error: true, message: "Không kết nối được với server", data: list_users });
        // }
        //
        // console.log('lol');
        //
        // let buffer = xlsx.build([{name: "Danh sách người dùng facebook", data: excelData }]); // Returns a buffer
        // // res.attachment('users.xlsx');
        // let date = new Date();
        // // let name = 'search-' + date.getTime();
        // let xlsxFilename = `search-${date.getTime()}.xlsx`;
        // let txtFilename = `phone-${date.getTime()}.txt`;
        // exportFileSuccess = false;
        //
        // try {
        //     fs.writeFileSync(`public/facebook/${xlsxFilename}`, buffer);
        //     exportFileSuccess =  true;
        // } catch (e) {
        //     return res.status(200).send({ status: 200, error: true, message: "Không xuất được file excel", data: list_users });
        // }
        //
        // try {
        //     fs.writeFileSync(`public/facebook/phone-${date.getTime()}.txt`, txtData.join('\n'));
        //     exportFileSuccess = true;
        // } catch (e) {
        //     console.log(e);
        //     return res.status(200).send({ status: 200, error: true, message: "Không xuất được file txt", data:  list_users});
        // }
        //
        // return res.status(200).send({
        //     status: 200,
        //     error: false,
        //     message: "success",
        //     data: {
        //         xlsxFilename: `/facebook/${xlsxFilename}`,
        //         txtFilename:  `/facebook/${txtFilename}`,
        //         total: list_uid.length,
        //         user_found: list_users.length,
        //         user_not_found: list_uid.length - list_users.length,
        //         users: list_users
        //     }
        // });
        if (list_uid.length > 50000) {
            return res.status(400).send({ status: 400, error: true, message: "Số  lượng UID không được quá 50.000", data: null });
        }


        console.log(list_uid);
        list_uid = ["100004433321360",
            "100015450037770"
        ];
        // { 'user_id': { $in: list_uid } }
        FacebookUser.find({ "phone": "841287951903" }, function( err, users) {
            if (err) {
                console.log(err);
                return res.status(500).send({ status: 500, error: true, message: "Xảy ra lỗi khi kết nối với server", data: null });
            }
            console.log(users);

            if (!users.length) {
                return res.status(200).send({ status: 200, error: true, message: "Không tìm thấy người dùng nào", data: null });
            }

            let excelData = [];

            excelData = users.map( item => {
                return [item.user_id, item.phone ];
             });

            excelData.unshift(["UID", "Phone" ]);

            let buffer = xlsx.build([{name: "Danh sách người dùng facebook", data: excelData }]); // Returns a buffer
            // res.attachment('users.xlsx');
            let date = new Date();
            // let name = 'search-' + date.getTime();
            let xlsxFilename = `search-${date.getTime()}.xlsx`;
            let txtFilename = `phone-${date.getTime()}.txt`;
            exportFileSuccess = false;

            try {
                fs.writeFileSync(`public/facebook/${xlsxFilename}`, buffer);
                exportFileSuccess =  true;
            } catch (e) {
                return res.status(200).send({ status: 200, error: true, message: "Không xuất được file excel", data: users });
            }

            try {
                let text = [];
                users.forEach( item => {
                    if (item.phone != '') {
                    text.push(item.phone);
                }
            });

                fs.writeFileSync(`public/facebook/phone-${date.getTime()}.txt`, text.join('\n'));
                exportFileSuccess = true;
            } catch (e) {
                return res.status(200).send({ status: 200, error: true, message: "Không xuất được file txt", data: users });
            }

            return res.status(200).send({
                status: 200,
                error: false,
                message: "success",
                data: {
                    xlsxFilename: `/facebook/${xlsxFilename}`,
                    txtFilename:  `/facebook/${txtFilename}`,
                    total: list_uid.length,
                    user_found: users.length,
                    user_not_found: list_uid.length - users.length,
                    users: users
                }
            });
        });
    } else {
        return res.status(400).send({ status: 400, error: true, message: "Chưa nhập uid hoăc tải file lên", data: null });
    }




});


router.get('/list_all', verify.verifyAppToken, function(req, res){
   User.find({}, function (err, users) {
      if(err) res.status(500).send({ message: "Can not connect to server"});
      res.status(200).send(users);
   })
});


// ****************************** FACEBOOK USER ******************************

router.get('/list-facebook-user/:page', function (req, res) {
   var perPage = 10;
   console.log(req.params.page);
   var page = req.params.page || 1;

   FacebookUser.find().skip((perPage * page) - perPage).limit(perPage)
   .exec(function(err, userList) {
      FacebookUser.count().exec(function(err, count) {
          if (err) return next(err)
          res.render('list-facebook-user', {
              userList: userList,
              maxPage: 13,
              current: page,
              pages: Math.ceil(count / perPage),
              index: perPage * page - perPage,
              title: 'Danh sách tài khoản',
              // moment: moment
          })
      })
   })
});

router.get('/get-facebook-user/:pageIndex', function(req, res){
    const pageIndex = req.params.pageIndex;
    const pageSize = 24;
    if (pageIndex == undefined) {
        return res.status(400).send({ status: 400, error: true, message: "Chưa chọn trang", data: null });
    }
    FacebookUserCrawler.find({}).skip(pageSize * (pageIndex -1)).limit(pageSize).exec(function(err, user){
        if (err) return res.status(500).send({status: 500, message: 'Không kết nối được đến server', error: true, data: null });
        return res.status(200).send({status: 200, message: 'success', error: false, data: user });
    });
});

router.get('/get-number-facebook-user', function(req, res){
    FacebookUserCrawler.count().exec(function(err, count) {
        if (err) return res.status(500).send({status: 500, message: 'Không kết nối được đến server', error: true, data: null });
        return res.status(200).send({status: 200, message: 'success', error: false, data: count });
    });
});

router.post('/search-facebook-user', function(req, res){
    const uid =  req.body.uid;
    if (uid == undefined) {
        return res.status(400).send({ status: 400, error: true, message: "Chưa nhập ID của nguời dùng", data: null });
    }
    if (uid.trim() == '') {
        FacebookUserCrawler.find({}).limit(24).exec(function(err, user){
            if (err) return res.status(500).send({status: 500, message: 'Không kết nối được đến server', error: true, data: null });
            return res.status(200).send({status: 200, message: 'success', error: false, data: user });
        });
    } else {
        FacebookUserCrawler.find({ _id: uid.trim() }).exec(function(err, count) {
            if (err) return res.status(500).send({status: 500, message: 'Không kết nối được đến server', error: true, data: null });
            return res.status(200).send({status: 200, message: 'success', error: false, data: count });
        });
    }

});


router.post('/list-facebook-user/1', function (req, res) {
   // router.post('/facbook-search', function (req, res) {
   console.log(req.body);
   // let x = 100;
   // console.log(new RegExp(x.trim()));
   var perPage = 10;
   var page = 1;
   const { uid, phone } = req.body;
   let searchQuery = {};
   if (uid != '') {
      searchQuery['user_id'] = uid.trim();
   }

   if (phone != '') {
      searchQuery['phone'] = new RegExp(phone.trim());
   }

   // console.log(searchQuery);

   // console.log(searchQuery != null);
   // console.log(searchQuery == null);
   let date = new Date();
   if (searchQuery.phone == undefined && searchQuery.user_id == undefined) {
      // console.log('redirect');
      return res.redirect('/api/user/list-facebook-user/1');
   }

   // .skip((perPage * page) - perPage).limit(perPage)
   // FacebookUser.findOne(searchQuery)
   FacebookUser.findOne(searchQuery)
   .exec(function(err, userList) {
      console.log(userList);
      FacebookUser.count().exec(function(err, count) {
         if (err) return next(err)
         res.render('list-facebook-user', {
              userList: userList ? [userList] : [],
              maxPage: 13,
              current: 1,
              pages: Math.ceil(count / perPage),
              index: perPage * page - perPage,
              title: 'Danh sách tài khoản',
              // moment: moment
         })
      })
   })
});

async function getUserFacebook(list_uid) {
    return new Promise((resolve, reject) => {
        FacebookUser.find({ 'user_id': { $in: list_uid } }).exec()
        .then(data => {
            resolve(data);
        })
        .catch( err => {
            reject(err);
        });
    });
}


function asyncUpdate(i, array) {
   if (i < array.length) {
      var row = array[i];
      axios.get('https://graph.facebook.com/' + row.user_id +
         '?fields=birthday,age_range,about,address,education,email,first_name,gender,hometown,link,last_name,location,name,middle_name,relationship_status'
         + '&access_token=283111455508809|l0GhSkkg0AHZkDEPimP50eBhz14'
      )
      .then( data => {
         var user_info = data.data;
         if(user_info.error) {
            console.log(i + '- can not update');
         } else {
            FacebookUser.findByIdAndUpdate( row._id, {
               status: 1,
               info: user_info
            }, function (err, obj) {
               console.log('update ' + i);
               asyncUpdate(i+1, array);
            });
         }
      })
      .catch( err => {
         console.log(i + ' - catch error');
         // console.log(err);
         asyncUpdate(i+1, array);
      })

   } else {
      console.log('finish update');
   }
};

function asyncInsert(i, array) {
   if (i < array.length) {
      var line = array[i].split('|');
      console.log(line[1]);
      FacebookUser.create({
         user_id: line[0],
         phone: line[1],
         info: []
      }, function (err, obj) {
         console.log('insert ' + i);
         asyncInsert(i+1, array);
      });
   } else {
      console.log('Finish last line');
   }
}

function asyncReadFile(dirname, i, listFiles) {
   if (i < listFiles.length) {
      fs.readFile(dirname + listFiles[i], 'utf-8', function(err, content) {
         if (err) {
            // onError(err);
            return;
         }
         var content = content.split('\n');
         console.log(content.length);
         // for (let j = 0; j < content.length; j++) {
         //    let row = content[j].split('|');
         //    // console.log(row);
         //    listUser.push({
         //       user_id: row[0],
         //       phone: row[1],
         //       info: []
         //    });
         // }
         // FacebookUser.insertMany( , { multiple: true })
         // asyncInsert(0, content);
      });
   } else {
      console.log('Finish read file ' + listFiles[i] );
   }
}

function updateFbCrontab() {
   FacebookUser.find({ status: 0 }).limit(590).exec()
   .then( data => {
      asyncUpdate(0, data);
   })
   .catch( err => {
      console.log(err);
      return;
   })
}

// var j = schedule.scheduleJob('*/10 * * * *', function(){
//    updateFbCrontab();
// });

router.post('/import-fb-user', function (req, res) {
   // let dirname = path.join(__root, 'public/Data/');
   let dirname = path.join(__root, 'public/test/');

   fs.readdir(dirname, function(err, filenames) {
      if (err) {
         // onError(err);
         return err;
      }
      for (var i = 0; i < 655; i++) {
         if (i%2 == 0){
            for (var j = i; j < i+2; j++) {
               let listUser = [];
               console.log('------------------------------------------------------------------------------' + j);
               let content = fs.readFileSync(dirname + filenames[j], 'utf-8');
               //if read file success and split content to lines
               content = content.split('\n');
               for (let k = 0; k < content.length; k++) {
                  let row = content[k].split('|');

                  listUser.push({
                     user_id: row[0],
                     phone: row[1],
                     info: []
                  });

                  if (k % 100 == 0)
                  {
                     console.log(listUser);
                     FacebookUser.insertMany( listUser, { multiple: true }, function(err, cb){
                        if(err) {
                           console.log(err);
                        } else {
                           console.log(cb);
                        }
                     });
                     listUser = [];
                  }

                  if ((content.length- 1) % 100 != 0)
                  {
                     console.log(content.length- 1);
                     FacebookUser.insertMany( listUser, { multiple: true }, function(err, cb){
                        if(err) {
                           console.log(err);
                        } else if (cb) {
                           console.log('insert success');
                        } else {
                           console.log('callback null');
                        }
                     });
                  }

               }



            }
         }
      }
      // let listUser = [];
      // for (var i = 0; i < filenames.length; i++) {
      //    console.log('------------------------------------------------------------------------------' + i);
      //    let content = fs.readFileSync(dirname + filenames[i], 'utf-8');
      //    //if read file success and split content to lines
      //    content = content.split('\n');
      //    for (let j = 0; j < content.length; j++) {
      //       let row = content[j].split('|');
      //       // console.log(row);
      //       listUser.push({
      //          user_id: row[0],
      //          phone: row[1],
      //          info: []
      //       });
      //    }
      // }
      // console.log('length ' +  listUser.length);
      // FacebookUser.insertMany( listUser, { multiple: true }, function(err, cb){
      //    if(err) {
      //       console.log(err);
      //    } else {
      //       console.log(cb);
      //    }
      // })



   });
});

// ****************************** END OF FACEBOOK USER ******************************



module.exports = router;
