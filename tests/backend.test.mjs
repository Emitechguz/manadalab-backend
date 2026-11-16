import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { Pool } from "pg";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test(
  "Backend completo contra PostgreSQL aislado", { timeout: 120000 }, async (t) => {
    const require = createRequire(import.meta.url);
    const originalUrl = process.env.DATABASE_URL;
    assert.ok(
      originalUrl,
      "Configura DATABASE_URL para crear una base de pruebas separada.",
    );
    const nombreBase = "manadalab_test_" + randomBytes(6).toString("hex");
    const url = new URL(originalUrl);
    url.pathname = "/" + nombreBase;
    delete process.env.DATABASE_HOST;
    const administrador = new Pool({
      connectionString: originalUrl,
      connectionTimeoutMillis: 5000,
    });
    let creada = false;
    let prisma;
    let servidor;
    try {
      await administrador.query('CREATE DATABASE "' + nombreBase + '"');
      creada = true;
      process.env.DATABASE_URL = url.toString();
      process.env.NODE_ENV = "test";
      process.env.APP_ORIGIN = "http://127.0.0.1:4000";
      process.env.JWT_SECRET = randomBytes(32).toString("hex");
      process.env.MATRICULA_KEY = randomBytes(32).toString("hex");
      process.env.IDEMPOTENCY_SECRET = randomBytes(32).toString("hex");
      process.env.MATRICULA_PATTERN = "^[A-Za-z0-9-]{1,32}$";
      const migracion = spawnSync(
        process.execPath,
        [
          require.resolve("prisma/build/index.js"),
          "migrate",
          "deploy",
          "--config",
          "prisma7.config.ts",
        ],
        { env: process.env, encoding: "utf8" },
      );
      assert.equal(
        migracion.status,
        0,
        "Las migraciones deben aplicarse en una base vacía.",
      );
      ({ prisma } = require("../dist/config/prisma.js"));
      const app = require("../dist/app.js").default;
      servidor = app.listen(0, "127.0.0.1");
      await new Promise((resolve, reject) => {
        servidor.once("listening", resolve);
        servidor.once("error", reject);
      });
      const base = "http://127.0.0.1:" + servidor.address().port;
      const contrasena = randomBytes(20).toString("hex");
      const hash = await argon2.hash(contrasena);
      const emaA = await prisma.ema.create({
        data: { nombre: "EMA de prueba A" },
      });
      const emaB = await prisma.ema.create({
        data: { nombre: "EMA de prueba B" },
      });
      const aulaA = await prisma.aula.create({
        data: { numero: "A01", emaId: emaA.id },
      });
      const aulaB = await prisma.aula.create({
        data: { numero: "B01", emaId: emaB.id },
      });
      const aulaVacia = await prisma.aula.create({
        data: { numero: "A02", emaId: emaA.id },
      });
      const pc = await prisma.tipoDispositivo.create({
        data: { nombre: "Computadora" },
      });
      const tv = await prisma.tipoDispositivo.create({
        data: { nombre: "TV" },
      });
      const antena = await prisma.tipoDispositivo.create({
        data: { nombre: "Antena Wi-Fi", esPrestable: true },
      });
      const dispositivo = (clave, tipoId, emaId, aulaId) =>
        prisma.dispositivo.create({ data: { clave, tipoId, emaId, aulaId } });
      const pcA = await dispositivo("PC-A", pc.id, emaA.id, aulaA.id);
      const pcB = await dispositivo("PC-B", pc.id, emaB.id, aulaB.id);
      const tvA = await dispositivo("TV-A", tv.id, emaA.id, aulaA.id);
      const tvB = await dispositivo("TV-B", tv.id, emaB.id, aulaB.id);
      const antenaA = await dispositivo("ANT-A", antena.id, emaA.id, null);
      const antenaB = await dispositivo("ANT-B", antena.id, emaB.id, null);
      const usuario = (nombre, emaId, esTecnico = false) =>
        prisma.usuario.create({
          data: {
            nombre,
            correo: nombre + "@example.test",
            emaId,
            esTecnico,
            contrasenaHash: hash,
          },
        });
      const adminA = await usuario("admin-a", emaA.id);
      const adminB = await usuario("admin-b", emaB.id);
      const tecnicoA = await usuario("tecnico-a", emaA.id, true);
      const tecnicoB = await usuario("tecnico-b", emaB.id, true);
      const llamar = async (
        ruta,
        { metodo = "GET", datos, sesion, cabeceras = {}, origen = true, texto, } = {},
      ) => {
        const headers = {
          ...(origen ? { Origin: process.env.APP_ORIGIN } : {}),
          ...(datos !== undefined || texto !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(sesion ? { Cookie: sesion.cookie, "X-CSRF-Token": sesion.csrfToken } : {}),
          ...cabeceras,
        };
        const respuesta = await fetch(base + ruta, {
          method: metodo,
          headers,
          body: texto ?? (datos !== undefined ? JSON.stringify(datos) : undefined),
        });
        const contenido = await respuesta.text();
        return {
          estado: respuesta.status,
          cuerpo: contenido ? JSON.parse(contenido) : null,
          headers: respuesta.headers,
        };
      };
      const acceder = async (cuenta) => {
        const r = await llamar("/api/sesion", {
          metodo: "POST",
          datos: { correo: cuenta.correo, contrasena },
        });
        assert.equal(r.estado, 200);
        return {
          cookie: r.headers.get("set-cookie").split(";")[0],
          csrfToken: r.cuerpo.csrfToken,
        };
      };
      const reporte = (unidad, clave = randomUUID(), extra = {}) =>
        llamar("/api/incidencias", {
          metodo: "POST",
          cabeceras: { "Idempotency-Key": clave },
          datos: {
            dispositivoId: unidad.id,
            matricula: "20260001",
            descripcion: "No funciona el dispositivo",
            ...extra,
          },
        });
      let reportePcA, reportePcB, reporteTvA, reporteTvB;
      let sesionA, sesionB, sesionTecnicoA, sesionTecnicoB;
      let claveOriginal;
      await t.test("Salud, paginación, filtros, ceros, 400 y 404", async () => {
        assert.equal((await llamar("/salud")).estado, 200);
        assert.equal((await llamar("/salud/listo")).estado, 200);
        const listado = await llamar("/api/aulas?emaId=" + emaA.id);
        assert.equal(listado.cuerpo.datos.length, 2);
        assert.equal(listado.cuerpo.paginacion.total, 2);
        assert.deepEqual(
          listado.cuerpo.datos.find((a) => a.id === aulaVacia.id).incidencias,
          { pendientes: 0, vistas: 0, solucionadas: 0 },
        );
        const pagina = await llamar("/api/aulas?pagina=2&limite=1");
        assert.equal(pagina.cuerpo.datos.length, 1);
        assert.equal(pagina.cuerpo.paginacion.total, 3);
        for (const query of [
          "pagina=hola",
          "limite=101",
          "emaId=0",
          "pagina=1&pagina=2",
          "otro=1",
          "pagina=2147483647&limite=100",
        ]) {
          assert.equal((await llamar("/api/aulas?" + query)).estado, 400);
        }
        assert.equal(
          (await llamar("/api/aulas?pagina=hola")).cuerpo.errores.length, 1,
        );
        assert.equal((await llamar("/api/no-existe")).estado, 404);
        assert.equal((await llamar("/api/aulas/999999/recursos")).estado, 404);
        assert.equal((await llamar("/api/aulas/abc/recursos")).estado, 400);
        assert.equal(
          (await llamar("/api/emas?limite=1")).cuerpo.paginacion.total, 2,
        );
      });
      await t.test(
        "Entradas de escritura, origen, tipo de contenido y privacidad",
        async () => {
          assert.equal(
            (
              await llamar("/api/incidencias", {
                metodo: "POST",
                datos: {},
                origen: false,
              })
            ).estado,
            403,
          );
          assert.equal(
            (
              await llamar("/api/incidencias", {
                metodo: "POST",
                texto: "texto",
                cabeceras: { "Content-Type": "text/plain" },
              })
            ).estado,
            415,
          );
          assert.equal(
            (await llamar("/api/incidencias", { metodo: "POST", texto: "{" }))
              .estado,
            400,
          );
          assert.equal(
            (
              await llamar("/api/incidencias", {
                metodo: "POST",
                datos: { descripcion: "x".repeat(20000) },
              })
            ).estado,
            413,
          );
          assert.equal((await reporte(antenaA)).estado, 400);
          assert.equal((await reporte({ id: 999999 })).estado, 404);
          assert.equal(
            (await reporte(pcA, randomUUID(), { esTecnico: true })).estado, 400,
          );
          assert.equal(
            (
              await llamar("/api/incidencias", {
                metodo: "POST",
                datos: {
                  dispositivoId: pcA.id,
                  matricula: "20260001",
                  descripcion: "No funciona",
                },
              })
            ).estado,
            400,
          );
        },
      );
      await t.test(
        "Alta atómica, reenvío simultáneo e idempotencia", async () => {
          claveOriginal = randomUUID();
          const respuestas = await Promise.all(
            Array.from({ length: 4 }, () => reporte(pcA, claveOriginal)),
          );
          respuestas.forEach((r) => assert.equal(r.estado, 201));
          reportePcA = respuestas[0].cuerpo.incidencia;
          respuestas.forEach((r) =>
            assert.equal(r.cuerpo.incidencia.folio, reportePcA.folio),
          );
          assert.equal(
            await prisma.incidencia.count({ where: { dispositivoId: pcA.id } }),
            1,
          );
          assert.equal(
            await prisma.historialIncidencia.count({
              where: { incidenciaId: reportePcA.id },
            }),
            1,
          );
          assert.equal(
            (
              await reporte(pcA, claveOriginal, {
                descripcion: "Contenido diferente",
              })
            ).estado,
            409,
          );
          const almacenada = await prisma.incidencia.findUniqueOrThrow({
            where: { id: reportePcA.id },
          });
          assert.ok(!almacenada.matriculaCifrada.includes("20260001"));
          assert.ok(almacenada.matriculaCifrada.startsWith("v1:"));
          assert.ok(
            !JSON.stringify(respuestas[0].cuerpo).includes("matricula"),
          );
          assert.ok(
            !JSON.stringify(respuestas[0].cuerpo).includes("descripcion"),
          );
          reportePcB = (await reporte(pcB)).cuerpo.incidencia;
          const concurrentes = await Promise.all(
            Array.from({ length: 5 }, () => reporte(tvA)),
          );
          assert.equal(concurrentes.filter((r) => r.estado === 201).length, 1);
          assert.equal(concurrentes.filter((r) => r.estado === 409).length, 4);
          reporteTvA = concurrentes[0].cuerpo.incidencia;
          reporteTvB = (await reporte(tvB)).cuerpo.incidencia;
          const recursos = await llamar("/api/aulas/" + aulaA.id + "/recursos");
          assert.equal(recursos.cuerpo.datos.length, 2);
          assert.ok(recursos.cuerpo.datos.every((d) => d.incidenciaActiva));
          const aulas = await llamar("/api/aulas?emaId=" + emaA.id);
          assert.equal(
            aulas.cuerpo.datos.find((a) => a.id === aulaA.id).incidencias
              .pendientes,
            2,
          );
          const publicas = await llamar("/api/incidencias?aulaId=" + aulaB.id);
          assert.equal(publicas.cuerpo.paginacion.total, 2);
          assert.ok(!JSON.stringify(publicas.cuerpo).includes("descripcion"));
          const detalle = await llamar("/api/incidencias/" + reportePcA.folio);
          assert.equal(detalle.estado, 200);
          assert.ok(!("version" in detalle.cuerpo));
        },
      );
      await t.test(
        "Autenticación, cookies, contexto y rechazo uniforme", async () => {
          for (const correo of [adminA.correo, "ausente@example.test"]) {
            const r = await llamar("/api/sesion", {
              metodo: "POST",
              datos: { correo, contrasena: "incorrecta" },
            });
            assert.equal(r.estado, 401);
            assert.equal(r.cuerpo.mensaje, "Correo o contraseña incorrectos.");
          }
          sesionA = await acceder(adminA);
          sesionB = await acceder(adminB);
          sesionTecnicoA = await acceder(tecnicoA);
          sesionTecnicoB = await acceder(tecnicoB);
          const login = await llamar("/api/sesion", {
            metodo: "POST",
            datos: { correo: adminA.correo, contrasena },
          });
          assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
          assert.match(login.headers.get("set-cookie"), /SameSite=Strict/i);
          const contexto = await llamar("/api/sesion", { sesion: sesionA });
          assert.equal(contexto.cuerpo.usuario.emaId, emaA.id);
          assert.equal(contexto.cuerpo.csrfToken, sesionA.csrfToken);
          assert.equal(contexto.headers.get("cache-control"), "no-store");
          assert.ok(
            !JSON.stringify(contexto.cuerpo).includes("contrasenaHash"),
          );
          assert.equal(
            (
              await llamar("/api/sesion", {
                cabeceras: { Cookie: "manadalab_sesion=token-invalido" },
              })
            ).estado,
            401,
          );
          assert.equal((await llamar("/api/admin/incidencias")).estado, 401);
          const expirado = jwt.sign({}, process.env.JWT_SECRET, {
            algorithm: "HS256",
            issuer: "manadalab",
            audience: "manadalab-api",
            subject: String(adminA.id),
            jwtid: randomUUID(),
            expiresIn: -1,
          });
          assert.equal(
            (
              await llamar("/api/sesion", {
                cabeceras: { Cookie: "manadalab_sesion=" + expirado },
              })
            ).estado,
            401,
          );
        },
      );
      await t.test(
        "Permisos entre EMAs, técnicos, CSRF y transiciones", async () => {
          assert.equal(
            (
              await llamar("/api/admin/incidencias/" + reportePcA.id, {
                sesion: sesionA,
              })
            ).estado,
            200,
          );
          assert.equal(
            (
              await llamar("/api/admin/incidencias/" + reportePcB.id, {
                sesion: sesionA,
              })
            ).estado,
            403,
          );
          assert.equal(
            (
              await llamar("/api/admin/incidencias/" + reportePcB.id, {
                sesion: sesionTecnicoA,
              })
            ).estado,
            200,
          );
          assert.equal(
            (
              await llamar("/api/admin/incidencias/" + reporteTvB.id, {
                sesion: sesionTecnicoA,
              })
            ).estado,
            403,
          );
          const vistaTecnica = await llamar("/api/admin/incidencias", {
            sesion: sesionTecnicoA,
          });
          assert.equal(vistaTecnica.cuerpo.paginacion.total, 3);
          const cambiar = (id, sesion, version, estado, extra = {}) =>
            llamar("/api/incidencias/" + id + "/estado", {
              metodo: "PATCH",
              sesion,
              datos: { version, estado },
              ...extra,
            });
          assert.equal(
            (await cambiar(reportePcA.id, sesionA, 1, "VISTO")).estado, 403,
          );
          assert.equal(
            (await cambiar(reporteTvB.id, sesionTecnicoA, 1, "VISTO")).estado,
            403,
          );
          assert.equal(
            (
              await cambiar(reporteTvA.id, sesionA, 1, "VISTO", {
                cabeceras: { "X-CSRF-Token": "" },
              })
            ).estado,
            403,
          );
          assert.equal(
            (
              await cambiar(reporteTvA.id, sesionA, 1, "VISTO", {
                cabeceras: { Origin: "https://otro.example" },
              })
            ).estado,
            403,
          );
          assert.equal(
            (await cambiar(reporteTvA.id, sesionA, 1, "SOLUCIONADO")).estado, 409,
          );
          const paralelo = await Promise.all([
            cambiar(reportePcA.id, sesionTecnicoA, 1, "VISTO"),
            cambiar(reportePcA.id, sesionTecnicoB, 1, "VISTO"),
          ]);
          assert.deepEqual(paralelo.map((r) => r.estado).sort(), [200, 409]);
          assert.equal(
            (await cambiar(reportePcA.id, sesionTecnicoB, 2, "SOLUCIONADO"))
              .estado,
            200,
          );
          assert.equal(
            (await cambiar(reportePcA.id, sesionTecnicoA, 3, "VISTO")).estado,
            409,
          );
          assert.equal(
            await prisma.historialIncidencia.count({
              where: { incidenciaId: reportePcA.id },
            }),
            3,
          );
          const repetido = await reporte(pcA, claveOriginal);
          assert.equal(repetido.estado, 201);
          assert.equal(repetido.cuerpo.incidencia.id, reportePcA.id);
          assert.equal(repetido.headers.get("idempotency-replayed"), "true");
          assert.equal((await reporte(pcA)).estado, 201);
          const resumen = (
            await llamar("/api/aulas?emaId=" + emaA.id)
          ).cuerpo.datos.find(
            (a) => a.id === aulaA.id
          );
          assert.deepEqual(resumen.incidencias, {
            pendientes: 2,
            vistas: 0,
            solucionadas: 1,
          });
          const filtrado = await llamar(
            "/api/incidencias?estado=SOLUCIONADO&emaId=" + emaA.id,
          );
          assert.equal(filtrado.cuerpo.paginacion.total, 1);
        },
      );
      await t.test(
        "Préstamos privados, unicidad y devoluciones idempotentes", async () => {
          assert.equal((await llamar("/api/prestamos")).estado, 404);
          assert.equal((await llamar("/api/admin/prestamos")).estado, 401);
          const prestar = (unidad) =>
            llamar("/api/admin/prestamos", {
              metodo: "POST",
              sesion: sesionA,
              datos: {
                dispositivoId: unidad.id,
                profesorNombre: "Profesor de prueba",
              },
            });
          assert.equal((await prestar(pcA)).estado, 400);
          assert.equal((await prestar(antenaB)).estado, 403);
          const respuestas = await Promise.all([
            prestar(antenaA), prestar(antenaA),
          ]);
          assert.deepEqual(respuestas.map((r) => r.estado).sort(), [201, 409]);
          const prestamo = respuestas.find((r) => r.estado === 201).cuerpo;
          assert.equal(
            (
              await llamar("/api/admin/prestamos/" + prestamo.id, {
                sesion: sesionB,
              })
            ).estado,
            403,
          );
          assert.equal(
            (
              await llamar("/api/admin/prestamos/" + prestamo.id, {
                sesion: sesionTecnicoB,
              })
            ).estado,
            403,
          );
          assert.equal(
            (
              await llamar("/api/admin/prestamos/dispositivos", {
                sesion: sesionA,
              })
            ).cuerpo.paginacion.total,
            0,
          );
          assert.equal(
            (
              await llamar("/api/admin/prestamos?estado=PENDIENTE", {
                sesion: sesionA,
              })
            ).cuerpo.paginacion.total,
            1,
          );
          const devolver = (sesion) =>
            llamar("/api/admin/prestamos/" + prestamo.id + "/devolucion", {
              metodo: "PATCH",
              sesion,
              datos: {},
            });
          assert.equal((await devolver(sesionTecnicoB)).estado, 403);
          const primera = await devolver(sesionA);
          const segunda = await devolver(sesionA);
          assert.equal(primera.estado, 200);
          assert.equal(
            segunda.cuerpo.fechaDevolucion, primera.cuerpo.fechaDevolucion,
          );
          assert.equal((await prestar(antenaA)).estado, 201);
        },
      );
      await t.test(
        "Restricciones reales de PostgreSQL y rollback", async () => {
          await assert.rejects(dispositivo("CRUCE", pc.id, emaA.id, aulaB.id));
          await assert.rejects(
            prisma.prestamo.create({
              data: {
                dispositivoId: antenaA.id,
                adminId: adminA.id,
                profesorNombre: "Prueba",
                fechaPrestamo: new Date(),
                fechaDevolucion: new Date(0),
              },
            }),
          );
          await assert.rejects(
            prisma.incidencia.create({
              data: {
                dispositivoId: pcB.id,
                descripcion: "Duplicado",
                matriculaCifrada: "prueba",
                estado: "PENDIENTE",
              },
            }),
          );
          await assert.rejects(
            prisma.reintentoAlta.create({
              data: { clave: randomUUID(), huella: "prueba", codigoHttp: 201 },
            }),
          );
          assert.equal(
            await prisma.dispositivo.count({ where: { clave: "CRUCE" } }), 0,
          );
          assert.equal(
            await prisma.reintentoAlta.count({ where: { codigoHttp: null } }), 0,
          );
        },
      );
      await t.test(
        "Revocación, cuenta deshabilitada y rol vigente", async () => {
          await prisma.usuario.update({
            where: { id: tecnicoA.id },
            data: { esTecnico: false },
          });
          assert.equal(
            (
              await llamar("/api/admin/incidencias/" + reportePcB.id, {
                sesion: sesionTecnicoA,
              })
            ).estado,
            403,
          );
          await prisma.usuario.update({
            where: { id: adminB.id },
            data: { activo: false },
          });
          assert.equal(
            (await llamar("/api/sesion", { sesion: sesionB })).estado, 401,
          );
          assert.equal(
            (
              await llamar("/api/sesion", {
                metodo: "DELETE",
                sesion: sesionA,
                cabeceras: { "X-CSRF-Token": "" },
              })
            ).estado,
            403,
          );
          assert.equal(
            (await llamar("/api/sesion", { metodo: "DELETE", sesion: sesionA }))
              .estado,
            204,
          );
          assert.equal(
            (await llamar("/api/sesion", { sesion: sesionA })).estado, 401,
          );
        },
      );
      await t.test("Límite de intentos por cuenta", async () => {
        let ultimo;
        for (let i = 0; i < 11; i++)
          ultimo = await llamar("/api/sesion", {
            metodo: "POST",
            datos: { correo: "limite@example.test", contrasena: "incorrecta" },
          });
        assert.equal(ultimo.estado, 429);
        assert.ok(ultimo.headers.has("retry-after"));
      });
      await t.test(
        "Carga privada reproducible, sin duplicados y sin mover inventario",
        async () => {
          const carpeta = await mkdtemp(
            join(tmpdir(), "manadalab-inventario-"),
          );
          const archivo = join(carpeta, "inventario.json");
          try {
            const inventario = [
              {
                nombre: "EMA importado de prueba",
                aulas: [{ numero: "I01" }],
                dispositivos: [{ clave: "IMPORTADO", tipo: "TV", aula: "I01" }],
              },
            ];
            await writeFile(archivo, JSON.stringify(inventario));
            const ejecutar = () =>
              spawnSync(
                process.execPath,
                ["scripts/administrar.mjs", "inventario", archivo],
                { env: process.env, encoding: "utf8" },
              );
            assert.equal(ejecutar().status, 0);
            assert.equal(ejecutar().status, 0);
            assert.equal(
              await prisma.dispositivo.count({ where: { clave: "IMPORTADO" } }),
              1,
            );
            inventario[0].dispositivos[0].aula = null;
            await writeFile(archivo, JSON.stringify(inventario));
            assert.equal(ejecutar().status, 1);
            const cuenta = spawnSync(
              process.execPath,
              ["scripts/administrar.mjs", "usuario"],
              {
                env: {
                  ...process.env,
                  ADMIN_NOMBRE: "Cuenta por CLI",
                  ADMIN_CORREO: "cli@example.test",
                  ADMIN_PASSWORD: contrasena,
                  ADMIN_EMA_ID: String(emaA.id),
                },
                encoding: "utf8",
              },
            );
            assert.equal(cuenta.status, 0);
            const almacenado = await prisma.usuario.findUniqueOrThrow({
              where: { correo: "cli@example.test" },
            });
            assert.ok(
              await argon2.verify(almacenado.contrasenaHash, contrasena),
            );
          } finally {
            await unlink(archivo);
            await rmdir(carpeta);
          }
        },
      );
      await t.test(
        "Cookie de producción y rechazo de algoritmo/origen incorrectos",
        async () => {
          const codigo =
            "const app=require('./dist/app.js').default; const s=app.listen(0,'127.0.0.1',()=>console.log('PUERTO:'+s.address().port));";
          const proceso = spawn(process.execPath, ["-e", codigo], {
            env: {
              ...process.env,
              NODE_ENV: "production",
              APP_ORIGIN: "https://manadalab.example",
            },
            stdio: ["ignore", "pipe", "pipe"],
          });
          try {
            const puerto = await new Promise((resolve, reject) => {
              const tiempo = setTimeout(
                () => reject(
                  new Error("El servidor de producción de prueba no inició."),
                ),
                10000,
              );
              proceso.once("exit", () => {
                clearTimeout(tiempo);
                reject(
                  new Error(
                    "El servidor de producción de prueba terminó antes de iniciar.",
                  ),
                );
              });
              proceso.stdout.on("data", (dato) => {
                const coincidencia = /PUERTO:(\d+)/.exec(dato.toString());
                if (coincidencia) {
                  clearTimeout(tiempo);
                  resolve(coincidencia[1]);
                }
              });
            });
            const direccion = "http://127.0.0.1:" + puerto;
            const login = await fetch(direccion + "/api/sesion", {
              method: "POST",
              headers: {
                Origin: "https://manadalab.example",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ correo: adminA.correo, contrasena }),
            });
            assert.equal(login.status, 200);
            const cookie = login.headers.get("set-cookie");
            assert.ok(cookie.startsWith("__Host-manadalab_sesion="));
            assert.match(cookie, /; Secure/i);
            assert.match(cookie, /HttpOnly/i);
            assert.match(cookie, /SameSite=Strict/i);
            assert.ok(!/Domain=/i.test(cookie));
            const malOrigen = await fetch(direccion + "/api/sesion", {
              method: "POST",
              headers: {
                Origin: "https://otro.example",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ correo: adminA.correo, contrasena }),
            });
            assert.equal(malOrigen.status, 403);
            const inseguro = jwt.sign({}, process.env.JWT_SECRET, {
              algorithm: "HS384",
              issuer: "manadalab",
              audience: "manadalab-api",
              subject: String(adminA.id),
              jwtid: randomUUID(),
            });
            assert.equal(
              (
                await llamar("/api/sesion", {
                  cabeceras: { Cookie: "manadalab_sesion=" + inseguro },
                })
              ).estado,
              401,
            );
          } finally {
            const terminado = new Promise((resolve) => proceso.once("exit", resolve),
            );
            proceso.kill();
            await terminado;
          }
        },
      );
      await t.test(
        "Arranque falla limpiamente si PostgreSQL no está disponible",
        async () => {
          const inaccesible = new URL(url);
          inaccesible.port = "1";
          const inicio = spawnSync(process.execPath, ["dist/server.js"], {
            env: { ...process.env, DATABASE_URL: inaccesible.toString() },
            encoding: "utf8",
            timeout: 15000,
          });
          assert.equal(inicio.status, 1);
          assert.ok(!inicio.stdout.includes("está escuchando"));
          assert.ok(!inicio.stderr.includes(decodeURIComponent(url.password)));
        },
      );
      await t.test(
        "Respaldo y restauración en otra base temporal", async () => {
          const nombreRestaurada = nombreBase + "_restore";
          await administrador.query(
            'CREATE DATABASE "' + nombreRestaurada + '"',
          );
          const urlRestaurada = new URL(url);
          urlRestaurada.pathname = "/" + nombreRestaurada;
          const restaurada = new Pool({
            connectionString: urlRestaurada.toString(),
          });
          try {
            const usuarioDb = decodeURIComponent(url.username);
            const copia = spawnSync(
              "docker",
              [
                "compose",
                "exec",
                "-T",
                "db",
                "pg_dump",
                "-U",
                usuarioDb,
                "-d",
                nombreBase,
                "-Fc",
              ],
              { cwd: ".", maxBuffer: 10 * 1024 * 1024 },
            );
            assert.equal(
              copia.status, 0, "pg_dump debe crear el respaldo de pruebas.",
            );
            const restauracion = spawnSync(
              "docker",
              [
                "compose",
                "exec",
                "-T",
                "db",
                "pg_restore",
                "-U",
                usuarioDb,
                "-d",
                nombreRestaurada,
                "--no-owner",
                "--exit-on-error",
              ],
              { cwd: ".", input: copia.stdout },
            );
            assert.equal(
              restauracion.status,
              0,
              "pg_restore debe restaurar el respaldo de pruebas.",
            );
            const filas = await restaurada.query(
              "SELECT count(*)::int AS total FROM incidencias",
            );
            assert.equal(filas.rows[0].total, await prisma.incidencia.count());
          } finally {
            await restaurada.end();
            assert.match(
              nombreRestaurada, /^manadalab_test_[a-f0-9]{12}_restore$/,
            );
            await administrador.query(
              'DROP DATABASE "' + nombreRestaurada + '" WITH (FORCE)',
            );
          }
        },
      );
    } finally {
      if (servidor)
        await new Promise((resolve, reject) =>
          servidor.close((error) => (error ? reject(error) : resolve())),
        );
      if (prisma) await prisma.$disconnect();
      if (creada) {
        assert.match(nombreBase, /^manadalab_test_[a-f0-9]{12}$/);
        await administrador.query(
          'DROP DATABASE "' + nombreBase + '" WITH (FORCE)',
        );
      }
      await administrador.end();
    }
  },
);
