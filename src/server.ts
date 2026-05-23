import { app } from './app';
import { config } from './config';
const PORT = parseInt(config.PORT, 10);
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📄 Swagger UI en http://localhost:${PORT}/api/docs`);
});
