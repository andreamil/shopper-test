import express, { Request, Response, NextFunction } from 'express';
import sequelize from './config/database';
import router from './routes';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 80;


app.use(cors({ origin: '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

app.use(router);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

const startServer = async () => {
  try {
    await sequelize.sync();

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
