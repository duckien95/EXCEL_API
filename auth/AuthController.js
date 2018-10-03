var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

var VerifyToken = require('./VerifyToken');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
var ClientApp = require('../client_app/ClientApp');
var User = require('../dao/user');

/**
 * Configure JWT
 */
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var bcrypt = require('bcryptjs');
var config = require('../config'); // get config file

router.get('/verify', function(req, res){
    User.findOne({ username: 'test0' }, function (err, user) {
        if (err) return res.status(500).send('Error on the server.');
        if (!user) return res.status(404).send('No user found.');
        let passwordValid = bcrypt.compareSync('test', user.password);
        if(passwordValid){
            res.status(200).send({ success: true });
        }
        else {
            res.status(200).send({ error: true });
        }
    })
})

router.get('/generate/:username/:password', function( req, res){
    const { username, password } =  req.params;
    var hashedPassword = bcrypt.hashSync(password, 8);
    ClientApp.create({
      appId : username,
      secretKey : hashedPassword
    },
    function (err, clientApp) {
      if (err) return res.status(500).send(err);

      // if user is registered without errors
      // create a token
      var token = jwt.sign({ id: clientApp._id }, config.secret, {
          expiresIn: 86400 // expires in 24 hours
      });

      res.status(200).send({ auth: true, token: token });
    });

})

router.post('/login', function(req, res) {
   let usr = req.body.username;
   let pwd = req.body.password;
   if(usr == undefined) {
      res.status(200).send({
         error: true,
         message: "Username is required!!!"
      });
     return;
   }
   if(pwd == undefined) {
      res.status(200).send({
         error: true,
         message: "Password is required!!!"
      });
      return;
   }
   User.findOne({ username: usr }, function (err, user) {
      if (err) return res.status(500).send('Error on the server.');
      if (!user) return res.status(404).send('No user found.');
      // check if the password is valid
      let passwordValid = bcrypt.compareSync(pwd, user.password);
      if(passwordValid){
         // if user is found and password is valid
         // create a token
         var token = jwt.sign({ userId:  user._id}, config.secret, {
            expiresIn: 86400 // expires 24 hours
         });
         // return the information including token as JSON
         res.status(200).send({
            message: "Login success",
            error: false,
            token: token,
            user: user
         });
      }
      else {
         res.status(200).send({ error: true });
      }
    })
})

router.post('/gettoken', function(req, res) {
      // console.log(req.body);
      console.log('login');
      if (req.body.appId == undefined) {
         return res.status(200).send({ auth: false, message: "AppId is required !!!" });
      }
      if (req.body.secretKey == undefined) {
         return res.status(200).send({ auth: false, message: "SecretKey is required !!!" });
      }

      ClientApp.findOne({ appId: req.body.appId }, function (err, clientApp) {
      if (err) return res.status(500).send({ auth: false, message: 'Error on the server.'});
      if (!clientApp) return res.status(404).send({ auth: false, message: 'No user found.'});

      // check if the password is valid
      var passwordIsValid = bcrypt.compareSync(req.body.secretKey, clientApp.secretKey);
      if (!passwordIsValid) return res.status(401).send({ auth: false, token: null, message: "Wrong password" });

      // if user is found and password is valid
      // create a token
      var token = jwt.sign({ id: clientApp._id }, config.secret, {
         expiresIn: 86400 // expires in 24 hours
      });

      // return the information including token as JSON
      res.status(200).send({ auth: true, token: token, appId: req.body.appId });
  });

});

router.get('/cleartoken', function(req, res) {
   res.status(200).send({ auth: false, token: null });
});

router.post('/registerapp', function(req, res) {

   var hashedPassword = bcrypt.hashSync(req.body.secretKey, 8);

   ClientApp.create({
      appId : req.body.appId,
      secretKey : hashedPassword
   },
   function (err, clientApp) {
      if (err) return res.status(500).send(err);

      // if user is registered without errors
      // create a token
      var token = jwt.sign({ id: clientApp._id }, config.secret, {
         expiresIn: 86400 // expires in 24 hours
      });

      res.status(200).send({ auth: true, token: token });
   });

});

router.get('/me', VerifyToken.verifyAppToken, function(req, res, next) {
   // console.log(req.clientAppId);
   ClientApp.findById(req.clientAppId, { secretKey: 0 }, function (err, clientApp) {
      if (err) return res.status(500).send("There was a problem finding the app.");
      if (!clientApp) return res.status(404).send("No app found.");
      res.status (200).send(clientApp);
   });

});

module.exports = router;
