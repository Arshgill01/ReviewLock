import { Hono } from 'hono';
import { apiRouter } from './routes/api';
import { formsRouter } from './routes/forms';
import { menuRouter } from './routes/menu';
import { triggersRouter } from './routes/triggers';

const app = new Hono();

app.route('/api', apiRouter);
app.route('/internal/menu', menuRouter);
app.route('/internal/form', formsRouter);
app.route('/internal/triggers', triggersRouter);

export default app;
