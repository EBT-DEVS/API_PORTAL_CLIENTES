import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    message: 'API REST Clientes funcionando',
  });
});

app.use('/api', routes);

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Ruta no encontrada',
  });
});

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    ok: false,
    message: err.message || 'Error interno del servidor',
  });
});

export default app;
