var express = require('express'),
    request = require('request'),
    https = require('https'),
	concur = require("concur-platform"),
	async = require("async");
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use( bodyParser.urlencoded() ); // to support URL-encoded bodies

app.get('/', function(req, response) {
  response.send('Hello World!');
});

// Generate your Concur token - https://developer.concur.com/oauth-20/native-flow
var concurToken = "<TODO: INSERT YOUR CONCUR ACCESS TOKEN HERE>";

var fromTwilio = {
	mediaUrl : "",
	msgBody  : 0.00
}

// Twilio account set to call /receiveMMS
// when Twilio number receives SMS/MMS

app.post('/receiveMMS', function (req, res) {
	fromTwilio.mediaUrl = req.body.MediaUrl0;
	fromTwilio.msgBody = +req.body.Body;  // check for NaN later

	// A value in MediaUrl{N} means MMS was received
	if(fromTwilio.mediaUrl) {

		async.waterfall([
			// 1. Post image to Concur using Concur module
			function(callback) {

				options = {
					oauthToken:concurToken,
					imageURL: fromTwilio.mediaUrl
				};

				concur.receipt.send(options)
				.then(function(imageId) {
					console.log(imageId);
					callback(null, imageId);
				})
				.fail(function(error) {
					console.log(error);
					///TODO: handle error
					//sendTwiml(res, error);
				});
			},
			// 2. Create expense entry and link image to it. (Not using 'concur-platform' this time for demo purposes)
			function(imageId, callback) {

				if (isNaN(fromTwilio.msgBody)) callback(null, "Receipt uploaded, expense entry skipped!");

				var now = new Date();
				var year = now.getFullYear();
				var month = now.getMonth();
				var date = now.getDate();

				var fullDate = year + '-' + (month +1) + '-' + date;

				//QuickExpense JSON payload
				var concurBody = {
					CurrencyCode: "USD",
					TransactionAmount: fromTwilio.msgBody,
					TransactionDate: fullDate,
					ReceiptImageID: imageId
				}

				var postData = JSON.stringify(concurBody);

				var headers = {
					'Content-Type': 'application/json',
					'Content-Length': postData.length,
					'Authorization': 'OAuth ' + concurToken,
					'Accept' : 'application/json'
				};

				var options = {
					host: 'www.concursolutions.com',
					port: 443,
					path: '/api/v3.0/expense/quickexpenses',
					method: 'POST',
					headers: headers
				};

				// Setup the request.
				var req = https.request(options, function (res) {
					res.setEncoding('utf-8');

					var responseString = '';

					res.on('data', function (data) {
						responseString += data;
					});

					res.on('end', function () {
						//console.log("Response: " + responseString);
						callback(null, "Receipt uploaded, expense entry created!");
					});
				});

				req.on('error', function (e) {
					// TODO: handle error.
				});

				req.write(postData);
				req.end();

			}
		],
		function(err, result) {
				console.log(result);
				sendTwiml(res, result); // Reply to user's MMS with some message
		})
	}
	else sendTwiml(res, "Please send an image of your receipt");
});

// Builds the TwiML (XML) request that this app sends back to Twilio so Twilio can SMS the 'message' back to the sender
function sendTwiml(res, message) {
   var twiml = '<?xml version="1.0" encoding="UTF-8" ?><Response><Sms>' + message + '</Sms></Response>';
   res.send(twiml, {
         'Content-Type': 'text/xml'
      }, 200);
}

///////--------------///////

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});