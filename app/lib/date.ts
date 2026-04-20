import { Corp } from './tipuri'

export const corpuri: Corp[] = [
    {
        id: 'corp-c',
        nume: 'Corp C',
        sali: [
            {
                id: 'c101',
                nume: 'C101',
                randuri: 4,
                coloane: 4,
                orar: {
                    ora: '10:00 - 12:00',
                    materie: 'Programare Web',
                    profesor: 'Prof. Ionescu',
                    grupa: '3A',
                },
                locuri: Array.from({ length: 16 }, (_, i) => ({
                    id: `c101-loc-${i + 1}`,
                    numar: i + 1,
                    ocupat: [2, 5, 6, 11].includes(i),
                    rezervat: [8].includes(i),
                })),
            },
            {
                id: 'c102',
                nume: 'C102',
                randuri: 3,
                coloane: 5,
                orar: {
                    ora: '12:00 - 14:00',
                    materie: 'Baze de Date',
                    profesor: 'Prof. Popescu',
                    grupa: '2B',
                },
                locuri: Array.from({ length: 15 }, (_, i) => ({
                    id: `c102-loc-${i + 1}`,
                    numar: i + 1,
                    ocupat: [1, 3, 7, 9, 13].includes(i),
                    rezervat: [4].includes(i),
                })),
            },
        ],
    },
    {
        id: 'corp-a',
        nume: 'Corp A',
        sali: [
            {
                id: 'a201',
                nume: 'A201',
                randuri: 4,
                coloane: 4,
                orar: {
                    ora: '08:00 - 10:00',
                    materie: 'Algoritmi',
                    profesor: 'Prof. Dumitrescu',
                    grupa: '1C',
                },
                locuri: Array.from({ length: 16 }, (_, i) => ({
                    id: `a201-loc-${i + 1}`,
                    numar: i + 1,
                    ocupat: [0, 4, 9, 14, 19, 24].includes(i),
                    rezervat: [2, 7].includes(i),
                })),
            },
        ],
    },
]