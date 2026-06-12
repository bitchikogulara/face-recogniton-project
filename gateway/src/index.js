require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { connectMqtt } = require('./mqtt');
const commandsRouter = require('./routes/commands');
const enrollRouter = require('./routes/enroll');
const devicesRouter = require('./routes/devices');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use('/command', commandsRouter);
app.use('/enroll', enrollRouter);
app.use('/devices', devicesRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function start() {
  await connectMqtt();
  app.listen(PORT, () => {
    console.log(`gateway listening on port ${PORT}`);
    console.log(`swagger docs available at http://localhost:${PORT}/docs`);
  });
}

start().catch(err => {
  console.error('failed to start gateway:', err.message);
  process.exit(1);
});
