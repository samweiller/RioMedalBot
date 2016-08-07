var cheerio = require('cheerio');
var request = require('request');
var countries = require("i18n-iso-countries");
var Botkit = require('botkit')
var firebase = require("firebase");
firebase.initializeApp({
    serviceAccount: "RioMedals-34dc3883662c.json",
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
var interval = setInterval(updateTheMedalCount, 90000);

////////////////////////////
/////    BOT STUFF    //////
////////////////////////////

// controllers.hears flag

controller.hears(["flag", "^pattern$"], ["ambient"], function(bot, message) {
    var theMessage = message.text
    if (theMessage.indexOf(':') == 0) {
        var theParsedCountry = theMessage.substring(6, 8).toUpperCase()
    }
    // bot.reply(message, 'The message was ' + theMessage + '. I heard a flag for ' + theParsedCountry)

    // var ref = firebase.database().ref("dinosaurs");
    //   countryRef.equalTo(theParsedCountry).once("value", function(snapshot) {
    //     console.log(snapshot.key);
    //     bot.reply(message, snapshot.gold)
    // });

    // GOLD
    countryRef.child(theParsedCountry).child('gold').once("value")
        .then(function(dataSnapshot) {
            // console.log('hello')
            // console.log(dataSnapshot.getKey())
            // console.log('Data ' + dataSnapshot.val())
            // console.log('post value')

            var goldToReport = dataSnapshot.val()
            console.log(goldToReport)

            // SILVER
            countryRef.child(theParsedCountry).child('silver').once("value")
                .then(function(dataSnapshot) {
                    var silverToReport = dataSnapshot.val()
                    console.log(silverToReport)

                    // BRONZE
                    countryRef.child(theParsedCountry).child('bronze').once("value")
                        .then(function(dataSnapshot) {
                            var bronzeToReport = dataSnapshot.val()
                            console.log(bronzeToReport)

                            countryRef.child(theParsedCountry).child('name').once("value")
                                .then(function(dataSnapshot) {
                                    var countryToReport = toTitleCase(dataSnapshot.val())
                                    console.log(countryToReport)

                                    var myJSONPackage = {
                                        "attachments": [{
                                            "fallback": "THINGS.",
                                            "title": ":flag-" + theParsedCountry + ": " + countryToReport + " :flag-" + theParsedCountry + ":"
                                        }, {
                                            "title": "Gold",
                                            "color": "#FFDF00",
                                            "text": goldToReport
                                        }, {
                                            "title": "Silver",
                                            "color": "#C0C0C0",
                                            "text": silverToReport
                                        }, {
                                            "title": "Bronze",
                                            "color": "#D4AF37",
                                            "text": bronzeToReport
                                        }]
                                    }

                                    bot.reply(message, countryToReport + ' has ' + goldToReport + ' gold medals.')
                                });


                        });
                });
        });





    // COUNTRY



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

            countryRef.child(alpha2Code).set({
                gold: 0,
                silver: 0,
                bronze: 0,
                name: countryName,
                country3Code: countryCode
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

            var alpha2Code = countries.getAlpha2Code(countryName, 'en')
            if (alpha2Code == undefined) {
                // alpha2Code = 'xx'
                alpha2Code = countries.alpha3ToAlpha2(countryCode)
            }

            if (alpha2Code == undefined) {
                alpha2Code = 'XX'
            }

            countryRef.child(alpha2Code).update({
                // name: countryName,
                gold: goldMedals,
                silver: silverMedals,
                bronze: bronzeMedals
            })
        })
    })

    console.log('done')
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
