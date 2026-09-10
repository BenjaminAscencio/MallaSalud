import {
    PrismaClient,
    Especialidad,
    RolUsuario,
    CanalOrigen,
    EstadoCita,
} from '@prisma/client';
import { fakerES_MX as faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Función auxiliar para calcular el Dígito Verificador (Módulo 11 chileno)
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
    if (resto === 11) return '0';
    if (resto === 10) return 'K';
    return resto.toString();
}

function generarRUTChileno(esAdultoMayor: boolean): string {
    // Adultos mayores: RUTs entre 4 y 12 millones | Jóvenes/Adultos: entre 13 y 21 millones
    const cuerpo = esAdultoMayor
        ? faker.number.int({ min: 4000000, max: 12000000 })
        : faker.number.int({ min: 13000000, max: 21000000 });
    const dv = calcularDV(cuerpo);
    return `${cuerpo}-${dv}`;
}

// Observaciones clínicas realistas para el contexto CESFAM
const observacionesPorEspecialidad: Record<Especialidad, string[]> = {
    [Especialidad.MEDICINA_GENERAL]: [
        'Control crónico de hipertensión arterial y diabetes mellitus.',
        'Paciente refiere cuadro respiratorio de 4 días de evolución con tos.',
        'Chequeo médico preventivo del adulto (EMPA).',
        'Dolor lumbar persistente sin irradiación tras esfuerzo físico.',
        'Renovación de recetas médicas y evaluación general.',
    ],
    [Especialidad.URGENCIA_DENTAL]: [
        'Dolor agudo en molar inferior derecho, refiere molestia al frío.',
        'Urgencia por fractura coronal de pieza dental anterior.',
        'Inflamación gingival y dolor localizado de 48 horas.',
        'Molestia intensa al masticar en zona premolar.',
    ],
    [Especialidad.MATRONERIA]: [
        'Control prenatal de rutina (semana 24 de gestación).',
        'Ingreso a control de salud sexual y reproductiva.',
        'Toma de Papanicolaou (PAP) y examen ginecológico preventivo.',
        'Orientación sobre métodos anticonceptivos y revisión de implante.',
    ],
};

async function main() {
    console.log('Limpiando base de datos previa...');
    await prisma.cita.deleteMany();
    await prisma.cupo.deleteMany();
    await prisma.paciente.deleteMany();
    await prisma.funcionario.deleteMany();

    console.log('Creando funcionarios (Médicos y Administrativos)...');
    const funcionariosData = [
        {
            rut: '15432890-K',
            nombre: 'Carolina',
            apellido: 'Soto',
            rol: RolUsuario.ADMIN_SOME,
            especialidad: null,
        },
        {
            rut: '16789452-3',
            nombre: 'Matías',
            apellido: 'Valenzuela',
            rol: RolUsuario.MEDICO,
            especialidad: Especialidad.MEDICINA_GENERAL,
        },
        {
            rut: '14238910-5',
            nombre: 'Valeria',
            apellido: 'Rojas',
            rol: RolUsuario.MEDICO,
            especialidad: Especialidad.URGENCIA_DENTAL,
        },
        {
            rut: '17890123-1',
            nombre: 'Fernanda',
            apellido: 'Morales',
            rol: RolUsuario.MEDICO,
            especialidad: Especialidad.MATRONERIA,
        },
    ];

    const funcionarios = [];
    for (const f of funcionariosData) {
        const func = await prisma.funcionario.create({ data: f });
        funcionarios.push(func);
    }

    // Mapa de médicos por especialidad para asignar citas
    const medicoPorEspecialidad: Record<Especialidad, number> = {
        [Especialidad.MEDICINA_GENERAL]: funcionarios.find(
            (f) => f.especialidad === Especialidad.MEDICINA_GENERAL
        )!.id,
        [Especialidad.URGENCIA_DENTAL]: funcionarios.find(
            (f) => f.especialidad === Especialidad.URGENCIA_DENTAL
        )!.id,
        [Especialidad.MATRONERIA]: funcionarios.find(
            (f) => f.especialidad === Especialidad.MATRONERIA
        )!.id,
    };

    console.log('Generando pacientes chilenos...');
    const pacientesAdultosMayores = [];
    const pacientesGenerales = [];

    // 15 Pacientes Adultos Mayores (+60 años para cupos prioritarios)
    for (let i = 0; i < 15; i++) {
        pacientesAdultosMayores.push({
            rut: generarRUTChileno(true),
            nombre: faker.person.firstName(),
            apellido: `${faker.person.lastName()} ${faker.person.lastName()}`,
            fechaNacimiento: faker.date.birthdate({ min: 61, max: 88, mode: 'age' }),
            telefono: `+569${faker.string.numeric(8)}`,
            correo: faker.internet.email().toLowerCase(),
        });
    }

    // 25 Pacientes Adultos Generales (<60 años)
    for (let i = 0; i < 25; i++) {
        pacientesGenerales.push({
            rut: generarRUTChileno(false),
            nombre: faker.person.firstName(),
            apellido: `${faker.person.lastName()} ${faker.person.lastName()}`,
            fechaNacimiento: faker.date.birthdate({ min: 18, max: 59, mode: 'age' }),
            telefono: `+569${faker.string.numeric(8)}`,
            correo: faker.internet.email().toLowerCase(),
        });
    }

    await prisma.paciente.createMany({
        data: [...pacientesAdultosMayores, ...pacientesGenerales],
    });

    // Recuperamos los pacientes con sus RUTs reales
    const todosLosPacientes = await prisma.paciente.findMany();
    const mayoresList = todosLosPacientes.filter((p) => {
        const edad =
            (Date.now() - new Date(p.fechaNacimiento).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25);
        return edad >= 60;
    });
    const generalesList = todosLosPacientes.filter((p) => !mayoresList.includes(p));

    let pacienteMayorIndex = 0;
    let pacienteGeneralIndex = 0;

    function obtenerSiguientePaciente(esPrioritario: boolean): string {
        if (esPrioritario && mayoresList.length > 0) {
            const rut = mayoresList[pacienteMayorIndex % mayoresList.length].rut;
            pacienteMayorIndex++;
            return rut;
        }
        const rut = generalesList[pacienteGeneralIndex % generalesList.length].rut;
        pacienteGeneralIndex++;
        return rut;
    }

    console.log('Generando cupos y estados de citas...');

    const especialidades = [
        Especialidad.MEDICINA_GENERAL,
        Especialidad.URGENCIA_DENTAL,
        Especialidad.MATRONERIA,
    ];

    const canales = [CanalOrigen.WEB, CanalOrigen.TELEFONO, CanalOrigen.VENTANILLA];

    // Días a poblar: Hoy y Mañana
    const dias = [
        { label: 'hoy', fecha: new Date() },
        {
            label: 'mañana',
            fecha: (() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                return d;
            })(),
        },
    ];

    const horas = [8, 9, 10, 11, 12, 14, 15, 16];

    let totalDisponibles = 0;
    let totalEnProceso = 0;
    let totalTomadas = 0;

    for (const dia of dias) {
        for (const esp of especialidades) {
            for (let i = 0; i < horas.length; i++) {
                const h = horas[i];
                const fechaCupo = new Date(dia.fecha);
                fechaCupo.setHours(h, 0, 0, 0);

                const esPrioritario = esp === Especialidad.MEDICINA_GENERAL && h < 10;

                // Definición del estado del cupo según la hora:
                // - 08:00, 09:00, 12:00 -> TOMADA (ya reservada con cita confirmada)
                // - 10:00               -> EN_PROCESO (en proceso de reserva / retenida temporalmente)
                // - 11:00, 14:00, 15:00, 16:00 -> DISPONIBLE (libre para tomar)
                let tipoCupo: 'TOMADA' | 'EN_PROCESO' | 'DISPONIBLE';

                if (h === 8 || h === 9 || h === 12) {
                    tipoCupo = 'TOMADA';
                } else if (h === 10) {
                    tipoCupo = 'EN_PROCESO';
                } else {
                    tipoCupo = 'DISPONIBLE';
                }

                if (tipoCupo === 'EN_PROCESO') {
                    // En proceso de tomarse:
                    // Retención temporal activa (bloqueada durante 2 minutos mientras confirma la reserva)
                    const bloqueadoHasta = new Date(Date.now() + 2 * 60 * 1000);
                    const bloqueadoPorRut = obtenerSiguientePaciente(esPrioritario);

                    await prisma.cupo.create({
                        data: {
                            fechaHora: fechaCupo,
                            especialidad: esp,
                            esPrioritario,
                            bloqueadoHasta,
                            bloqueadoPorRut,
                        },
                    });

                    totalEnProceso++;
                } else if (tipoCupo === 'TOMADA') {
                    // Cita ya tomada y confirmada:
                    const pacienteRut = obtenerSiguientePaciente(esPrioritario);
                    const funcionarioId = medicoPorEspecialidad[esp];
                    const canal = canales[(i + esp.length) % canales.length];

                    // Si la cita es de hoy y de hora temprana ya pasada, la marcamos como ATENDIDA; si no, RESERVADA
                    const esPasada = dia.label === 'hoy' && h < new Date().getHours();
                    const estado = esPasada ? EstadoCita.ATENDIDA : EstadoCita.RESERVADA;

                    const obsList = observacionesPorEspecialidad[esp];
                    const observaciones = obsList[i % obsList.length];

                    const cupoCreado = await prisma.cupo.create({
                        data: {
                            fechaHora: fechaCupo,
                            especialidad: esp,
                            esPrioritario,
                            bloqueadoHasta: null,
                            bloqueadoPorRut: null,
                            cita: {
                                create: {
                                    pacienteRut,
                                    funcionarioId,
                                    canal,
                                    estado,
                                    observaciones,
                                },
                            },
                        },
                    });

                    totalTomadas++;
                } else {
                    // Cupo disponible / libre
                    await prisma.cupo.create({
                        data: {
                            fechaHora: fechaCupo,
                            especialidad: esp,
                            esPrioritario,
                            bloqueadoHasta: null,
                            bloqueadoPorRut: null,
                        },
                    });

                    totalDisponibles++;
                }
            }
        }
    }

    console.log('\n======================================================');
    console.log('¡Base de datos poblada exitosamente!');
    console.log('======================================================');
    console.log(`Funcionarios creados : ${funcionarios.length}`);
    console.log(`Pacientes creados    : ${todosLosPacientes.length} (${mayoresList.length} adultos mayores, ${generalesList.length} generales)`);
    console.log(`Total cupos creados  : ${totalDisponibles + totalEnProceso + totalTomadas}`);
    console.log(`Disponibles       : ${totalDisponibles} (listas para tomarse)`);
    console.log(`En proceso        : ${totalEnProceso} (bloqueadas temporalmente / inactivas)`);
    console.log(`Tomadas           : ${totalTomadas} (con citas confirmadas en Box)`);
    console.log('======================================================\n');
}

main()
    .catch((e) => {
        console.error(' Error ejecutando el seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
