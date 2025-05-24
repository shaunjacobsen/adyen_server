import express, { Request, Response } from 'express';
const { Client, CheckoutAPI, Webhook } = require('@adyen/api-library');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/webhook', (req: Request, res: Response) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('Received');
});

app.get('/', (req: Request, res: Response) => {
  res.send('Webhook listener running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
