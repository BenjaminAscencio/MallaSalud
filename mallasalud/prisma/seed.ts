import { PrismaClient, Especialidad, EstadoBloque } from "@prisma/client";
import { fakerES_MX as faker } from "@faker-js/faker";

const prisma = new PrismaClient();

function calcularDV(cuerpo: number): string {
  let suma = 0;
  let multiplo = 2;
  let valor = cuerpo;

  while (valor > 0) {
    suma += (valor % 10) * multiplo;
    valor = Math.floor(valor / 10);
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return resto.toString();
}

function generarRutValido(min: number, max: number): string {
  const num = faker.number.int({ min, max });
  const dv = calcularDV(num);
  return `${num}-${dv}`;
}

async function main() {
  console.log("=================================================");
  console.log("   INICIANDO SEEDING MALLASALUD (POSTGRESQL)   ");
  console.log("=================================================");

  // 1. Limpieza idempotente en orden estricto de claves foráneas
  console.log("Limpiando datos preexistentes...");
  await prisma.registroSms.deleteMany();
  await prisma.cita.deleteMany();
  await prisma.bloqueHorario.deleteMany();
  await prisma.agendaMedica.deleteMany();
  await prisma.box.deleteMany();
  await prisma.profesional.deleteMany();
  await prisma.paciente.deleteMany();
  console.log("Tablas limpiadas correctamente.");

  // 2. Insertar Pacientes Fijos de Prueba (Coherencia Demográfica Chilena)
  console.log("Creando pacientes de prueba con correlativo demográfico...");

  const pacientesFijos = [
    {
      rut: "21111111-1",
      nombres: "Ignacio Andrés",
      apellidos: "Morales Soto",
      fecha_nacimiento: new Date("2002-04-15T00:00:00Z"), // 24 años
      telefono: "+56921111111",
      estado_inscripcion: true,
      contador_inasistencias: 0,
    },
    {
      rut: "5555555-5",
      nombres: "Elena Rosa",
      apellidos: "Valenzuela Castro",
      fecha_nacimiento: new Date("1951-03-20T00:00:00Z"), // 75 años (Adulto Mayor >= 60)
      telefono: "+56955555555",
      estado_inscripcion: true,
      contador_inasistencias: 0,
    },
    {
      rut: "16666666-6",
      nombres: "Matías Sebastián",
      apellidos: "Rojas Herrera",
      fecha_nacimiento: new Date("1988-08-10T00:00:00Z"), // 38 años
      telefono: "+56916666666",
      estado_inscripcion: true,
      contador_inasistencias: 2, // 2 inasistencias NSP para probar modal educativo
    },
  ];

  for (const p of pacientesFijos) {
    await prisma.paciente.create({ data: p });
  }

  // 10 pacientes adicionales generados con Faker con coherencia demográfica:
  // 3 Adultos Mayores (RUT 4M-9M, nacidos 1945-1964)
  console.log("Generando 3 adultos mayores adicionales (RUT 4M-9M)...");
  for (let i = 0; i < 3; i++) {
    const añoNac = faker.number.int({ min: 1945, max: 1964 });
    const mesNac = faker.number.int({ min: 1, max: 12 });
    const diaNac = faker.number.int({ min: 1, max: 28 });
    const rut = generarRutValido(4500000, 9500000);

    await prisma.paciente.create({
      data: {
        rut,
        nombres: faker.person.firstName(),
        apellidos: `${faker.person.lastName()} ${faker.person.lastName()}`,
        fecha_nacimiento: new Date(`${añoNac}-${String(mesNac).padStart(2, "0")}-${String(diaNac).padStart(2, "0")}T00:00:00Z`),
        telefono: `+569${faker.string.numeric(8)}`,
        estado_inscripcion: true,
        contador_inasistencias: 0,
      },
    });
  }

  // 7 Jóvenes/Adultos (RUT 15M-22M, nacidos 1982-2004)
  console.log("Generando 7 pacientes jóvenes/adultos adicionales (RUT 15M-22M)...");
  for (let i = 0; i < 7; i++) {
    const añoNac = faker.number.int({ min: 1982, max: 2004 });
    const mesNac = faker.number.int({ min: 1, max: 12 });
    const diaNac = faker.number.int({ min: 1, max: 28 });
    const rut = generarRutValido(15000000, 22000000);

    await prisma.paciente.create({
      data: {
        rut,
        nombres: faker.person.firstName(),
        apellidos: `${faker.person.lastName()} ${faker.person.lastName()}`,
        fecha_nacimiento: new Date(`${añoNac}-${String(mesNac).padStart(2, "0")}-${String(diaNac).padStart(2, "0")}T00:00:00Z`),
        telefono: `+569${faker.string.numeric(8)}`,
        estado_inscripcion: true,
        contador_inasistencias: faker.helpers.arrayElement([0, 0, 1]),
      },
    });
  }

  // 3. Insertar Boxes Clínicos
  console.log("Creando boxes clínicos...");
  const boxes = await Promise.all([
    prisma.box.create({
      data: { numero: "Box 101 - Medicina", especialidad: Especialidad.MEDICINA_GENERAL, activo: true },
    }),
    prisma.box.create({
      data: { numero: "Box 102 - Medicina", especialidad: Especialidad.MEDICINA_GENERAL, activo: true },
    }),
    prisma.box.create({
      data: { numero: "Box 201 - Dental", especialidad: Especialidad.DENTAL, activo: true },
    }),
    prisma.box.create({
      data: { numero: "Box 301 - Matronería", especialidad: Especialidad.MATRONERIA, activo: true },
    }),
  ]);

  // 4. Insertar Profesionales de la Salud
  console.log("Creando profesionales de la salud...");
  const profesionales = await Promise.all([
    prisma.profesional.create({
      data: {
        rut: "14258369-7",
        nombres: "Carlos",
        apellidos: "Muñoz Valenzuela",
        especialidad: Especialidad.MEDICINA_GENERAL,
        activo: true,
      },
    }),
    prisma.profesional.create({
      data: {
        rut: "16789456-1",
        nombres: "Valentina",
        apellidos: "Silva Osorio",
        especialidad: Especialidad.MEDICINA_GENERAL,
        activo: true,
      },
    }),
    prisma.profesional.create({
      data: {
        rut: "15321654-K",
        nombres: "Roberto",
        apellidos: "Cárdenas Pinto",
        especialidad: Especialidad.DENTAL,
        activo: true,
      },
    }),
    prisma.profesional.create({
      data: {
        rut: "17896321-4",
        nombres: "Camila",
        apellidos: "Fuentes Rivas",
        especialidad: Especialidad.MATRONERIA,
        activo: true,
      },
    }),
  ]);

  // 5. Generar Agendas y Bloques Horarios para Hoy y Mañana
  console.log("Generando agendas y bloques horarios (Hoy y Mañana)...");
  const hoy = new Date();
  const mañana = new Date();
  mañana.setDate(mañana.getDate() + 1);

  const dias = [hoy, mañana];

  for (const dia of dias) {
    const fechaNorm = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0, 0);

    const configuraciones = [
      { prof: profesionales[0], box: boxes[0], esp: Especialidad.MEDICINA_GENERAL, esCuota: true },
      { prof: profesionales[1], box: boxes[1], esp: Especialidad.MEDICINA_GENERAL, esCuota: true },
      { prof: profesionales[2], box: boxes[2], esp: Especialidad.DENTAL, esCuota: false },
      { prof: profesionales[3], box: boxes[3], esp: Especialidad.MATRONERIA, esCuota: false },
    ];

    for (const conf of configuraciones) {
      const agenda = await prisma.agendaMedica.create({
        data: {
          profesional_id: conf.prof.id,
          box_id: conf.box.id,
          especialidad: conf.esp,
          fecha: fechaNorm,
          hora_inicio: "08:00",
          hora_fin: "17:00",
          duracion_bloque_min: 20,
          activa: true,
        },
      });

      // Generación de bloques de 20 minutos excluyendo colación 13:00 - 14:00
      const bloquesData = [];
      let currentMinutes = 8 * 60; // 08:00
      const endMinutes = 17 * 60;  // 17:00

      while (currentMinutes + 20 <= endMinutes) {
        const nextMin = currentMinutes + 20;

        // Excluir colación [13:00, 14:00) => [780, 840)
        if (!(currentMinutes < 840 && nextMin > 780)) {
          const hIni = new Date(fechaNorm);
          hIni.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);

          const hFin = new Date(fechaNorm);
          hFin.setHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0);

          bloquesData.push({
            agenda_id: agenda.id,
            hora_inicio: hIni,
            hora_fin: hFin,
            estado_bloque: EstadoBloque.DISPONIBLE,
            es_cuota_adulto_mayor: false,
          });
        }
        currentMinutes += 20;
      }

      // Si aplica cuota mayor (Medicina General), marcar 30% de bloques de forma intercalada (08:20, 09:00, 09:40...)
      if (conf.esCuota) {
        const numCuota = Math.round(bloquesData.length * 0.3);
        let asignados = 0;
        for (let b = 1; b < bloquesData.length && asignados < numCuota; b += 2) {
          bloquesData[b].es_cuota_adulto_mayor = true;
          asignados++;
        }
        for (let b = 0; b < bloquesData.length && asignados < numCuota; b += 2) {
          bloquesData[b].es_cuota_adulto_mayor = true;
          asignados++;
        }
      }

      await prisma.bloqueHorario.createMany({
        data: bloquesData,
      });
    }
  }

  const [totalPacientes, totalAgendas, totalBloques] = await Promise.all([
    prisma.paciente.count(),
    prisma.agendaMedica.count(),
    prisma.bloqueHorario.count(),
  ]);

  console.log("=================================================");
  console.log("             SEED COMPLETADO CON ÉXITO           ");
  console.log("=================================================");
  console.log(`- Pacientes registrados : ${totalPacientes}`);
  console.log(`- Boxes clínicos        : ${boxes.length}`);
  console.log(`- Profesionales activos : ${profesionales.length}`);
  console.log(`- Agendas creadas       : ${totalAgendas}`);
  console.log(`- Bloques generados     : ${totalBloques}`);
  console.log("-------------------------------------------------");
  console.log("CASOS DE PRUEBA CONTROLADOS PARA TESTING:");
  console.log(" 1) [HU-001] Adulto Joven (0 inasistencias)   : RUT 21111111-1 (24 años, 2002)");
  console.log(" 2) [HU-001] Adulto Mayor >=60 (0 inasist.)  : RUT 5555555-5 (75 años, 1951, 5.555.555-5)");
  console.log(" 3) [HU-001] Con Inasistencias (NSP = 2)     : RUT 16666666-6 (38 años, 1988, 16.666.666-6)");
  console.log(" 4) [HU-001/HU-006] No Inscritos en BD (404 / Alta Rápida):");
  console.log("    - Joven No Inscrito: RUT 21222222-2");
  console.log("    - Adulto Mayor No Inscrito: RUT 6666666-6");
  console.log("=================================================");
}

main()
  .catch((e) => {
    console.error("Error fatal durante el seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
