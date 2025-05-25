import express, { Request, Response } from 'express';
import { Client, CheckoutAPI, hmacValidator } from '@adyen/api-library';
import { v4 as uuid } from 'uuid';
import { set } from './store';

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const adyenClient = new Client({
  apiKey: process.env.adyen_api_key ?? '',
  environment: 'TEST',
});

const checkout = new CheckoutAPI(adyenClient);

const determineHostUrl = (req: Request) => {
  let {
    'x-forwarded-proto': forwardedProto,
    'x-forwarded-host': forwardedHost,
  } = req.headers;

  if (forwardedProto && forwardedHost) {
    if (forwardedProto.includes(',')) {
      // @ts-ignore
      [forwardedProto] = forwardedProto.split(',');
    }

    return `${forwardedProto}://${forwardedHost}`;
  }

  return 'http://localhost:8080';
};

app.use(express.json());

app.post('/api/session', async (req: Request, res: Response) => {
  try {
    const {orderRef, amount, items} = req.body;

    if (!orderRef) throw new Error('No order reference provided');

    console.log('Received payment request for orderRef: ' + orderRef);

    // Ideally the data passed here should be computed based on business logic
    const response = await checkout.PaymentsApi.sessions({
      countryCode: 'NL',
      amount: { currency: 'EUR', value: 25000 },
      reference: orderRef,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT ?? '',
      returnUrl: `${determineHostUrl(req)}/redirect?orderRef=${orderRef}`, // required for 3ds2 redirect flow
      // set lineItems required for some payment methods (ie Klarna)
      lineItems: [
        { quantity: 1, amountIncludingTax: 20000, description: 'Lloyd Wright coffee table' },
        { quantity: 1, amountIncludingTax: 500, description: 'van der Rohe centerpiece' },
      ],
    });

    // save transaction in memory
    // enable webhook to confirm the payment (change status to Authorized)
    const transaction = {
      amount: { currency: 'EUR', value: 1000 },
      paymentRef: orderRef,
      status: 'Pending',
    };

    set(orderRef, transaction);

    res.json(response);
  } catch (err: any) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

// app.post('/api/payment', (req: Request, res: Response) => {

// });

app.post('/api/webhook', (req: Request, res: Response) => {
  console.log('Webhook received');
  console.dir(req.body, { depth: null });

  // this code was taken from https://github.com/adyen-examples/adyen-node-online-payments/tree/main/checkout-example
  const hmacKey = process.env.ADYEN_HMAC_KEY ?? '';
  const validator = new hmacValidator();

  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest?.notificationItems;

  // fetch first (and only) NotificationRequestItem
  const notification = notificationRequestItems[0]?.NotificationRequestItem;
  console.log('Notification: ', notification);

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
