var cheerio = require('cheerio');
var request = require('request');
var countries = require("i18n-iso-countries");
var Botkit = require('botkit')
var firebase = require("firebase");
firebase.initializeApp({
    serviceAccount: "RioMedals-1db94db3db72.json",
    databaseURL: "https://riomedals.firebaseio.com/"
});
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', function(req, res) {
    res.status(200).send('Hello world!');
});

var db = firebase.database();
var ref = db.ref("/");
var countryRef = ref.child("countries");

require('dotenv').config();

var controller = Botkit.slackbot({
    interactive_replies: true // tells botkit to send button clicks into conversations
}).configureSlackApp({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    scopes: ['bot', 'commands', 'files:write:user'],
});

controller.setupWebserver(process.env.PORT, function(err, webserver) {
    controller.createHomepageEndpoint(controller.webserver);
    controller.createWebhookEndpoints(controller.webserver);

    controller.createOauthEndpoints(controller.webserver, function(err, req, res) {
        if (err) {
            res.status(500).send('ERROR: ' + err);
        } else {
            res.send('Success!');
        }
    });
});

app.set('port', (process.env.PORT || 9001));

app.get('/', function(req, res) {
    res.send('It works!');
});

var _bots = {};

function trackBot(bot) {
    _bots[bot.config.token] = bot;
}


controller.on('create_bot', function(bot, config) {
    if (_bots[bot.config.token]) {
        // already online! do nothing.
    } else {
        bot.startRTM(function(err) {
            if (!err) {
                trackBot(bot);
            }

            bot.startPrivateConversation({
                user: config.createdBy
            }, function(err, convo) {
                if (err) {
                    console.log(err);
                } else {
                    convo.say('I am a bot that has just joined your team');
                    convo.say('You must now /invite me to a channel so that I can be of use!');
                }
            });
        });
    }
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function(bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function(bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});

console.log('Here we go!')

// initializeTheDatabase();
var interval = setInterval(updateTheMedalCount, 50000);

  ////////////////////////////
 /////    BOT STUFF    //////
////////////////////////////

// controllers.hears flag

controller.hears(["flag", "^pattern$"], ["ambient"], function(bot, message) {
  var theMessage = message.text
  if (theMessage.indexOf(':') == 0 && theMessage.indexOf(':', 1) == 0) {
      var theParsedCountry = theMessage.substring(6, 8)
  }
  bot.reply(message, 'I heard a flag for ' + theParsedCountry)
})


  ////////////////////////////
 /////    FUNCTIONS    //////
////////////////////////////

// Initialization
function initializeTheDatabase() {
    var initURL = "https://www.rio2016.com/en/countries"

    request({
        method: 'GET',
        url: initURL
    }, function(err, response, html) {
        if (err) return console.error(err);
        $ = cheerio.load(html);

        $('.table-ordenation__col--flag').each(function() {
            var countryCode = $(this).text().replace(/\s/g, "") // CountryCode
            var countryName = $(this).parent().find('.table-ordenation__col--country-name').attr('data-href').substring(4).replace(/\-/g, ' ') // CountryName
            var alpha2Code = countries.getAlpha2Code(countryName, 'en')
            if (alpha2Code == undefined) {
                // alpha2Code = 'xx'
                alpha2Code = countries.alpha3ToAlpha2(countryCode)
            }

            if (alpha2Code == undefined) {
                alpha2Code = 'XX'
            }

            countryRef.child(countryCode).set({
                gold: 0,
                silver: 0,
                bronze: 0,
                name: countryName,
                alpha2: alpha2Code
            })
        })
    })
}

function updateTheMedalCount() {
    var theURL = "https://www.rio2016.com/en/medal-count-country"

    request({
        method: 'GET',
        url: theURL
    }, function(err, response, html) {
        if (err) return console.error(err);
        $ = cheerio.load(html);

        $('.table-medal-countries__link-table').each(function() {
            var countryCode = $(this).attr('data-odfcode') // CountryCode
            var countryName = $(this).find('.col-2').find('.flag').attr('title') // CountryName
            var goldMedals = $(this).find('.col-4').html() // gold
            var silverMedals = $(this).find('.col-5').html() // silver
            var bronzeMedals = $(this).find('.col-6').html() // bronze

            countryRef.child(countryCode).update({
                // name: countryName,
                gold: goldMedals,
                silver: silverMedals,
                bronze: bronzeMedals
            })
        })
    })

    console.log('done')
}
