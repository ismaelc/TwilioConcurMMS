## Using Twilio MMS to submit your business expense

_The following is a guest post by Chris Ismael, Senior Developer Evangelist at Concur.  Concur offers itinerary/expense solutions and APIs that give developers access to its 25M users across 20,000 businesses.  Learn more about the Concur Platform at [The Perfect Trip DevCon](http://developer.concur.com/devcon) this Oct 30th_

This is a short post that demonstrates how you can submit your expenses to Concur using Twilio's new MMS API.

Concur is used by business travelers to help save time in capturing and submitting expenses for reimbursement. One of many ways users do this through the Concur app is by using the phone's camera (or album) to take a picture of the receipt to be sent for expense.


![](https://jfqcza.bn1301.livefilestore.com/y2pdcqo0d4eNhIJGkAJJSwspXb6kNyfUPOasr3W3pCw_3ROd6B64lSAvPoG3jq8bhTyPjD3ujpYK8WC2PXglZCjFGKN91k_vD7ppANGDXtPW78/cameraDemo.PNG?psid=1)


Through [Twilio MMS](https://www.twilio.com/mms) and Concur's [ReceiptImages API](https://www.concursolutions.com/api/docs/index.html#!/ReceiptImages), we can recreate the same functionality, minus the mobile app.  This solution will provide users the option of skipping the app altogether and use their phone's native messaging functionality to send the image through MMS. Users also get an added bonus of not having to use their mobile data to go through the process - particularly useful if you want to save yourself or the company money especially when traveling abroad.

Here's a short demo showing how this works:

<a target="_blank" href="https://www.youtube.com/watch?v=jvaKLyyWjLc"><img src="https://jfqcza.bn1301.livefilestore.com/y2poj9tBy1iIuc6IpTGZLnap0ab3cAm6hutsXwK2_YYlhqOpqNX1iQhclvxClMRr6kQNcHAfmkqQVUUHzMWW4uc9AZU0Yt4CHyeDlnc3d6cT3o/Capture%201.PNG?psid=1" /></a>

The flow is explained in the diagram below.  To get started, you would need a Twilio account and setup your MMS.  You can follow this [excellent blog post](https://www.twilio.com/blog/2014/09/getting-started-with-twilio-mms.html) by Kevin Whinnery to set up your Twilio MMS.  You also have the option signing up for a [Concur developer sandbox account](https://developer.concur.com/) if you intend to run the same example in this post.

![](https://jfqcza.bn1301.livefilestore.com/y2pG-OH8zIcw6SXk_SdQxwVpfztEoFBmkPq41sn_yiFtOp3fL0gPiytvpbYs_G0sxsURzQLunNZWBXsU3s1eMtkPuW42gk5wc7WOB2VqY1d-5g/TwilioConcur60.png?psid=1)

The code example walkthrough is split into four parts:

1.  Capturing data sent by Twilio MMS to our node.js app
2.  POSTing the image to Concur's ReceiptImages API
3.  POSTing the amount text to Concur's QuickExpense API
4.  Use TwiML to send confirmation SMS to user

**Let's get started!**

1.  **Capturing data sent by Twilio MMS to our node.js app**

        // After setting up Twilio to call our node.js app 
        // ('/receiveMMS') when an SMS/MMS is received,
        // the snippet below will get the Twilio-hosted
        // MMS image URL and the message body, which
        // represent the image receipt and expense amt
        
        app.post('/receiveMMS', function (req, res) {
       
	       fromTwilio.mediaUrl = req.body.MediaUrl0;
	       fromTwilio.msgBody = +req.body.Body;  
     	                 
	       ....
	
        });

2.  **POSTing the image to Concur's ReceiptImages API**

    	// *Post image to Concur using Concur module* (Coming soon!)
        // The snippet below takes the Twilio-hosted MMS image URL
        // and passes it to be uploaded to Concur
      
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
	      });
        },

3.  **POSTing the expense amount to Concur's QuickExpense API**

        // *Create expense entry and link image to it*
 
        function(imageId, callback) {
 
	        // Check if text message was included in MMS
	        if (isNaN(fromTwilio.msgBody)) callback(null, "Receipt uploaded, expense entry skipped!");
 
	        var now = new Date();
	        var year = now.getFullYear();
	        var month = now.getMonth();
	        var date = now.getDate();
 
	        var fullDate = year + '-' + (month +1) + '-' + date;
 
	        // Populate QuickExpense JSON payload with
	        // expense amount text sent through Twilio MMS
	        var concurBody = {
	        	CurrencyCode: "USD",
	        	TransactionAmount: fromTwilio.msgBody,
	        	TransactionDate: fullDate,
	        	ReceiptImageID: imageId
        	}
        
        	var postData = JSON.stringify(concurBody);
        
        	// Authorization parameters for Concur API
        	var headers = {
        		'Content-Type': 'application/json',
        		'Content-Length': postData.length,
        		'Authorization': 'OAuth ' + concurToken,
        		'Accept' : 'application/json'
        	};
        
        	// Point call to QuickExpense Concur API
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

4.  **Use TwiML to send confirmation to user**

        // *Builds the TwiML (XML) request that this app sends back to Twilio, to be relayed back as SMS to user*
        // Sample usage: sendTwiml(res, "Receipt uploaded, expense entry created!")
 
        function sendTwiml(res, message) {
            var twiml = '<?xml version="1.0" encoding="UTF-8" ?><Response><Sms>' + message + '</Sms></Response>';
            res.send(twiml, {
                'Content-Type': 'text/xml'
            }, 200);
        }

You can check out the entire source code [here.](https://github.com/ismaelc/TwilioConcurMMS)

Through Twilio MMS, we provided an extra choice for users to interact with their organization's business logic - through SMS/MMS. If your company provides APIs for developers, Twilio MMS is worth exploring.