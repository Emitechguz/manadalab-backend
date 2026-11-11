import app from "./app.js";
import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";

const puerto = env.puerto;
const direccion = env.direccion;

async function iniciarServidor() {
  await prisma.$queryRaw`SELECT 1`;

  console.log("Conexión con PostgreSQL comprobada.");

  const servidor = app.listen(puerto, direccion);

  await new Promise<void>((resolve, reject) => {
    servidor.once("error", reject);

    servidor.once("listening", () => {
      servidor.off("error", reject);
      resolve();
    });
  });

  console.log(`ManadaLab está escuchando en http://${direccion}:${puerto}`);

  let cerrando = false;

  async function cerrarServidor() {
    if (cerrando) return;
    cerrando = true;

    console.log("Cerrando el backend...");

    const limiteCierre = setTimeout(() => {
      console.error("Se agotó el tiempo de cierre del backend.");
      process.exit(1);
    }, 10_000);

    limiteCierre.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        servidor.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      await prisma.$disconnect();

      clearTimeout(limiteCierre);
      console.log("Backend cerrado correctamente.");
    } catch {
      console.error("Ocurrió un error durante el cierre del backend.");
      process.exitCode = 1;
    }
  }

  process.once("SIGINT", () => {
    void cerrarServidor();
  });

  process.once("SIGTERM", () => {
    void cerrarServidor();
  });
}

iniciarServidor().catch(async () => {
  console.error(
    "No se pudo iniciar el backend. Revisa PostgreSQL y el puerto 4000.",
  );

  try {
    await prisma.$disconnect();
  } catch {
    console.error(
      "No se pudo cerrar correctamente el cliente de base de datos.",
    );
  }

  process.exitCode = 1;
});
