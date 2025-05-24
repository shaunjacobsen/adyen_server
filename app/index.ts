import express, { Request, Response } from 'express';
const {
  Client,
  CheckoutAPI,
  Webhook,
  hmacValidator,
} = require('@adyen/api-library');

const app = express();
const PORT = process.env.PORT || 3000;

const adyenClient = new Client({
  apiKey: process.env.adyen_api_key,
  environment: 'TEST',
});

app.use(express.json());

app.post('/webhook', (req: Request, res: Response) => {
  console.log('Webhook received');
  console.dir(req.body, { depth: null });

  // this code was taken from https://github.com/adyen-examples/adyen-node-online-payments/tree/main/checkout-example
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator();

  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest.notificationItems;

  // fetch first (and only) NotificationRequestItem
  const notification = notificationRequestItems[0].NotificationRequestItem;
  console.log(notification);

  // Handle the notification
  if (validator.validateHMAC(notification, hmacKey)) {
    // valid hmac: process event
    const merchantReference = notification.merchantReference;
    const eventCode = notification.eventCode;
    console.log(
      'merchantReference:' + merchantReference + ' eventCode:' + eventCode,
    );

    // do something like update db, this is up to the client

    // acknowledge event has been consumed
    res.status(202).send(); // Send a 202 response with an empty body
  } else {
    // invalid hmac
    console.log('Invalid HMAC signature: ' + notification);
    res.status(401).send('Invalid HMAC signature');
  }
});

app.get('/', (req: Request, res: Response) => {
  res.send('Webhook listener running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
