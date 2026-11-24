import { defineConfig } from 'vite';
import { createOffice } from './server/app.js';

// No desenvolvimento, o próprio Vite responde as rotas do backend, para rodar
// num processo só. Mesma porta do serviço: com o Vite de pé, o serviço fica
// parado.
function officeApi() {
  return {
    name: 'my-office-api',
    configureServer(server) {
      const office = createOffice();
      server.middlewares.use(office.handle);
      server.httpServer?.on('close', () => office.close());
    },
  };
}

export default defineConfig({
  plugins: [officeApi()],
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  preview: { host: '127.0.0.1', port: 5199, strictPort: true },
});
