const express = require('express')
const router = express.Router();
const { sendMessagePost } = require('../controllers/web')|

router.post('/send', sendMessagePost)


router.get('/about', function(req, res) {
    res.send('About birds');
  });



module.exports = router