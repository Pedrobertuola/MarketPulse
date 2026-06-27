import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { marketRoutes } from './routes/marketRoutes';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3333);

app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.use('/api', marketRoutes);

app.listen(port, () => {
  console.log(`MarketPulse backend listening on port ${port}`);
});
