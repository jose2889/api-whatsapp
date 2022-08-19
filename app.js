/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()
const fs = require('fs');
const express = require('express');
const cors = require('cors')
const qrcode = require('qrcode-terminal');
const { Client,LocalAuth, Buttons  } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send')

const app = express();
app.use(cors())
app.use(express.json())
const MULTI_DEVICE = process.env.MULTI_DEVICE || 'true';
const server = require('http').Server(app)

const port = process.env.PORT || 3000
var client;


app.use('/', require('./routes/web'))



/**
 * Escuchamos cuando entre un mensaje
 */
const listenMessage = () => client.on('message', async msg => {
    const { from, body, hasMedia } = msg;

console.log("escuchando mensajes ", from, body, hasMedia) 

    if(!isValidNumber(from)){
        return
    }

    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if (from === 'status@broadcast') {
        return
    }
    message = body.toLowerCase();
    console.log('BODY',message)
    const number = cleanNumber(from)
    await readChat(number, message)

    /**
     * Guardamos el archivo multimedia que envia
     */
    if (process.env.SAVE_MEDIA && hasMedia) {
        const media = await msg.downloadMedia();
        saveMedia(media);
    }

    /**
     * Si estas usando dialogflow solo manejamos una funcion todo es IA
     */

    if (process.env.DATABASE === 'dialogflow') {
        if(!message.length) return;
        const response = await bothResponse(message);
        await sendMessage(client, from, response.replyMessage);
        if (response.media) {
            sendMedia(client, from, response.media);
        }
        return
    }

    /**
    * Ver si viene de un paso anterior
    * Aqui podemos ir agregando más pasos
    * a tu gusto!
    */

    const lastStep = await lastTrigger(from) || null;
    if (lastStep) {
        const response = await responseMessages(lastStep)
        await sendMessage(client, from, response.replyMessage);
    }

    /**
     * Respondemos al primero paso si encuentra palabras clave
     */
    const step = await getMessages(message);

    console.log("obtener mensaje ", step)

    if (step) {
        const response = await responseMessages(step);

        /**
         * Si quieres enviar botones
         */
        await sendMessage(client, from, response.replyMessage, response.trigger);

        if(response.hasOwnProperty('actions')){
           
            const { actions } = response;
            await sendMessageButton(client, from, null, actions);
            return
        }

        if (!response.delay && response.media) {
            sendMedia(client, from, response.media);
        }
        if (response.delay && response.media) {
            setTimeout(() => {
                sendMedia(client, from, response.media);
            }, response.delay)
        }
        return
    }

    //Si quieres tener un mensaje por defecto
    if (process.env.DEFAULT_MESSAGE === 'true') {
        const response = await responseMessages('DEFAULT')
        await sendMessage(client, from, response.replyMessage, response.trigger);

        /**
         * Si quieres enviar botones
         */
        if(response.hasOwnProperty('actions')){
            const { actions } = response;
            await sendMessageButton(client, from, null, actions);
        }
        return
    }
});



client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { headless: true }
    });
    
client.on('qr', qr => generateImage(qr, () => {
        qrcode.generate(qr, { small: true });
        
        console.log(`Ver QR http://localhost:${port}/qr`)
        socketEvents.sendQR(qr)
}))

client.on('ready', (a) => {
        connectionReady()
        listenMessage()
        // socketEvents.sendStatus(client)
});

client.on('auth_failure', (e) => {
         console.log("Fallo la conexion con el servidor de whatsapp",e)
        // connectionLost()
});

client.on('authenticated', () => {
        console.log('Autenticado con éxito.'); 
});

    client.initialize();



/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
    mysqlConnection.connect()
}

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})

app.post('/notificationws', (req, res) => {
    
    const { message, number } = req.body

    let msj = 
        `Estimado *${message}* le notificamos que se ha agendado su reserva con exito 🙂🤖\n Para su comodidad se ha enviado una notificación a su correo donde podra gestionar su reserva \n`;
    
    client.sendMessage(number, message);

    res.send({ status: 'Ok' })
}
)

app.post('/confirmationws', (req, res) => {
    
    const { message, number, reservationId } = req.body



    let msj =
        `Estimado *${message}* le recordamos que el dia 12-12-2022 a las 13:45 tiene reservado una cita en Roslin \n Marque *1* para confirmar su reserva\n Marque *2* para canceular su reserva\n`;
    

    client.sendMessage(number, message);
    readChat(message, number, reservationId)
  
    res.send({ status: 'Ok' })
}
)

app.post('/', (req, res) => {

  
    res.send({ status: 'En linea' })
}
)



checkEnvFile();

