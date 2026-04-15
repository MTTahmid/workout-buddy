import express from 'express';
import cors from 'cors';
import user from './routes/userRoutes.js'
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
  res.send('Hello from backend API!');
});

app.use('/user', user);

export default app;