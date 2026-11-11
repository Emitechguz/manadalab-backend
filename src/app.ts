import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import aulasRouter from "./routes/aulas.routes.js";
import sesionRouter from "./routes/sesion.routes.js";
import {
  incidenciasRouter,
  adminIncidenciasRouter,
} from "./routes/incidencias.routes.js";
import prestamosRouter from "./routes/prestamos.routes.js";
import { manejarErrores } from "./middlewares/errores.middleware.js";
import { manejarRutaNoEncontrada } from "./middlewares/ruta-no-encontrada.middleware.js";
import { limiteGeneral } from "./middlewares/seguridad.middleware.js";
import { validarEntrada } from "./middlewares/validacion.middleware.js";
import { paginacionSchema } from "./schemas/comunes.schema.js";
import { emas } from "./controllers/inventario.controller.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);
app.use(
  helmet({ strictTransportSecurity: env.produccion ? undefined : false }),
);
app.use(cookieParser());
app.use(express.json({ limit: "16kb", strict: true }));
app.get("/salud", (_solicitud, respuesta) => {
  respuesta.json({ estado: "activo" });
});
app.get("/salud/listo", async (_solicitud, respuesta) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    respuesta.json({ estado: "listo" });
  } catch {
    respuesta.status(503).json({ estado: "no_disponible" });
  }
});
app.use("/api", limiteGeneral, (_solicitud, respuesta, siguiente) => {
  respuesta.set("Cache-Control", "no-store");
  siguiente();
});
app.get("/api/emas", validarEntrada(paginacionSchema, "query"), emas);
app.use("/api/aulas", aulasRouter);
app.use("/api/sesion", sesionRouter);
app.use("/api/incidencias", incidenciasRouter);
app.use("/api/admin/incidencias", adminIncidenciasRouter);
app.use("/api/admin/prestamos", prestamosRouter);
app.use(manejarRutaNoEncontrada);
app.use(manejarErrores);
export default app;
