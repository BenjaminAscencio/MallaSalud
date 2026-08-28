import { PrismaClient, Especialidad, RolUsuario } from '@prisma/client';
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

async function main() {
    console.log('Limpiando base de datos previa...');
    await prisma.cita.deleteMany();
    await prisma.cupo.deleteMany();
    await prisma.paciente.deleteMany();
    await prisma.funcionario.deleteMany();

    console.log('Creando funcionarios (Médicos y Administrativos)...');
    await prisma.funcionario.createMany({
        data: [
            {
                rut: '15432890-K',
                nombre: 'Carolina',
                apellido: 'Soto',
                rol: RolUsuario.ADMIN_SOME,
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
        ],
    });

    console.log('Generando pacientes (Adultos mayores y adultos jóvenes)...');
    const pacientesData = [];

    // 15 Pacientes Adultos Mayores (+60 años para cupos prioritarios)
    for (let i = 0; i < 15; i++) {
        pacientesData.push({
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
        pacientesData.push({
            rut: generarRUTChileno(false),
            nombre: faker.person.firstName(),
            apellido: `${faker.person.lastName()} ${faker.person.lastName()}`,
            fechaNacimiento: faker.date.birthdate({ min: 18, max: 59, mode: 'age' }),
            telefono: `+569${faker.string.numeric(8)}`,
            correo: faker.internet.email().toLowerCase(),
        });
    }

    await prisma.paciente.createMany({ data: pacientesData });

    console.log('Generando cupos de prueba para mañana...');
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const especialidades = [
        Especialidad.MEDICINA_GENERAL,
        Especialidad.URGENCIA_DENTAL,
        Especialidad.MATRONERIA,
    ];

    const horas = [8, 9, 10, 11, 12, 14, 15, 16];
    const cuposData = [];

    for (const esp of especialidades) {
        for (const h of horas) {
            const fechaCupo = new Date(manana);
            fechaCupo.setHours(h, 0, 0, 0);

            cuposData.push({
                fechaHora: fechaCupo,
                especialidad: esp,
                esPrioritario: esp === Especialidad.MEDICINA_GENERAL && h < 10, // Horas tempranas como prioritarias
            });
        }
    }

    await prisma.cupo.createMany({ data: cuposData });

    console.log('¡Base de datos poblada exitosamente con datos realistas!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });