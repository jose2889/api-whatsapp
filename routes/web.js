const express = require('express');
const router = express.Router()
const { getQr, sendMessagePost } = require('../controllers/web')


router.use('/qr', getQr)

router.post('/enviar', sendMessagePost);

module.exports = router